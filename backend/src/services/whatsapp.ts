import { Client, LocalAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { analyzeCheckIn } from './ai'

let client: Client | null = null
let latestQr: string | null = null
let isReady = false

export function getWhatsAppClient(): Client | null {
  return client
}

export function getLatestQr(): string | null {
  return latestQr
}

export function isWhatsAppReady(): boolean {
  return isReady
}

export async function sendMessage(phoneNumber: string, message: string): Promise<void> {
  if (!client || !isReady) {
    console.warn('[WA] Client not ready, skipping message to', phoneNumber)
    return
  }
  const chatId = phoneNumber.replace('+', '') + '@c.us'
  await client.sendMessage(chatId, message)
}

export function buildCheckInMessage(
  patientName: string,
  question: string
): string {
  return `Good morning ${patientName}! 👋\n\n${question}\n\nReply to this message with your answer.\n\n_Toju — Your health partner_`
}

async function handleInboundMessage(msg: { from: string; body: string; reply: (text: string) => Promise<any> }) {
  if (msg.from === 'status@broadcast') return

  const phone = '+' + msg.from.replace('@c.us', '')
  const patient = await Patient.findOne({ phoneNumber: phone })

  if (!patient) return

  if (!patient.signal || !patient.signal.approvedAt) {
    await msg.reply(
      `Hello! Your care plan is being set up by your doctor. We will reach out to you once everything is ready. 🙏`
    )
    return
  }

  const redFlags = (patient.signal as any).redFlags ?? []
  const medications = ((patient.signal as any).medications ?? []).map(
    (m: any) => `${m.name} ${m.dose} ${m.frequency}`
  )
  const analysis = await analyzeCheckIn(
    msg.body,
    redFlags,
    patient.name,
    patient.diagnosis,
    medications
  )

  await CheckIn.create({
    patientId: patient._id,
    doctorId: patient.doctorId,
    message: msg.body,
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

  await msg.reply(analysis.botResponse)
}

export function initWhatsApp(): void {
  const executablePath =
    process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
  })

  client.on('qr', (qr) => {
    latestQr = qr
    console.log('[WA] Scan the QR code below to connect WhatsApp:')
    qrcode.generate(qr, { small: true })
  })

  client.on('ready', () => {
    isReady = true
    latestQr = null
    console.log('[WA] WhatsApp client connected and ready')
  })

  client.on('authenticated', () => {
    console.log('[WA] Authenticated successfully')
  })

  client.on('auth_failure', (msg) => {
    console.error('[WA] Authentication failed:', msg)
    isReady = false
  })

  client.on('disconnected', (reason) => {
    console.warn('[WA] Disconnected:', reason)
    isReady = false
    latestQr = null
  })

  client.on('message', (msg) => {
    handleInboundMessage(msg).catch((err) =>
      console.error('[WA] Error handling message:', err)
    )
  })

  client.initialize().catch((err) => {
    console.error('[WA] Failed to initialize:', err.message)
    console.warn('[WA] Server will continue without WhatsApp. Fix the issue and restart.')
    isReady = false
  })
  console.log('[WA] Initializing WhatsApp client...')
}