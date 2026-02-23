import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { analyzeCheckIn } from './ai'

let sock: WASocket | null = null
let latestQr: string | null = null
let isReady = false
let initializing = false

export function getLatestQr(): string | null {
  return latestQr
}

export function isWhatsAppReady(): boolean {
  return isReady
}

export async function sendMessage(phoneNumber: string, message: string): Promise<void> {
  if (!sock || !isReady) {
    throw new Error('WhatsApp client is not connected. Go to Dashboard → WhatsApp to scan the QR code.')
  }
  const jid = phoneNumber.replace('+', '') + '@s.whatsapp.net'
  await sock.sendMessage(jid, { text: message })
}

export function buildCheckInMessage(patientName: string, question: string): string {
  return `Good morning ${patientName}! 👋\n\n${question}\n\nReply to this message with your answer.\n\n_Toju — Your health partner_`
}

async function handleInboundMessage(msg: WAMessage) {
  const sender = msg.key.remoteJid
  if (!sender || msg.key.fromMe || sender === 'status@broadcast') return

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''
  if (!text) return

  const phone = '+' + sender.replace('@s.whatsapp.net', '')
  const patient = await Patient.findOne({ phoneNumber: phone })
  if (!patient) return

  if (!patient.signal || !patient.signal.approvedAt) {
    await sock?.sendMessage(sender, {
      text: `Hello! Your care plan is being set up by your doctor. We will reach out to you once everything is ready. 🙏`,
    })
    return
  }

  const redFlags = (patient.signal as any).redFlags ?? []
  const medications = ((patient.signal as any).medications ?? []).map(
    (m: any) => `${m.name} ${m.dose} ${m.frequency}`
  )
  const analysis = await analyzeCheckIn(
    text,
    redFlags,
    patient.name,
    patient.diagnosis,
    medications
  )

  await CheckIn.create({
    patientId: patient._id,
    doctorId: patient.doctorId,
    message: text,
    riskScore: analysis.riskScore,
    triggeredFlags: analysis.triggeredFlags,
    botResponse: analysis.botResponse,
  })

  patient.riskScore = analysis.riskScore
  patient.lastCheckIn = new Date()
  await patient.save()

  if (analysis.riskScore === 'red') {
    await Alert.create({
      patientId: patient._id,
      doctorId: patient.doctorId,
      type: 'red_flag',
      message: `Red flag triggered: ${analysis.triggeredFlags.join(', ')}`,
    })
  }

  await sock?.sendMessage(sender, { text: analysis.botResponse })
}

export async function initWhatsApp(): Promise<void> {
  if (initializing) {
    console.warn('[WA] Already initializing, skipping duplicate call')
    return
  }
  initializing = true

  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        latestQr = qr
        console.log('[WA] QR code generated — scan it to connect')
      }

      if (connection === 'open') {
        isReady = true
        latestQr = null
        initializing = false
        console.log('[WA] WhatsApp client connected and ready')
      }

      if (connection === 'close') {
        isReady = false
        latestQr = null
        initializing = false

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        if (loggedOut) {
          console.warn('[WA] Logged out — delete auth_info/ and restart to re-scan QR')
          sock = null
        } else {
          console.warn('[WA] Disconnected (code ' + statusCode + '), reconnecting in 5s…')
          sock = null
          setTimeout(() => {
            if (!initializing) initWhatsApp()
          }, 5000)
        }
      }
    })

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        handleInboundMessage(msg).catch((err) =>
          console.error('[WA] Error handling message:', err)
        )
      }
    })

    console.log('[WA] Initializing WhatsApp client…')
  } catch (err: any) {
    console.error('[WA] Failed to initialize:', err.message)
    console.warn('[WA] Server will continue without WhatsApp. Fix the issue and restart.')
    isReady = false
    initializing = false
  }
}
