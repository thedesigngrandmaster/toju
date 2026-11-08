import crypto from 'crypto'
import { Client, LocalAuth, type Message } from 'whatsapp-web.js'
import { env } from '../config/env'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { InboundMessage } from '../models/InboundMessage'
import { analyzeCheckIn } from './ai'
import { enqueueOutboundMessage, startOutboundProcessor } from './outbound'
import { recordAudit } from './audit'
import { normalizePhone, toChatId, toDisplayPhone } from '../utils/phone'

export type WhatsAppState =
  | 'disabled'
  | 'starting'
  | 'qr'
  | 'ready'
  | 'auth_failure'
  | 'disconnected'

let client: Client | null = null
let latestQr: string | null = null
let state: WhatsAppState = 'starting'
let initializing = false
let lastError: string | null = null

export function getLatestQr(): string | null {
  return latestQr
}

export function isWhatsAppReady(): boolean {
  return state === 'ready'
}

export function getWhatsAppState(): WhatsAppState {
  return state
}

export function getWhatsAppLastError(): string | null {
  return lastError
}

/** Sends immediately through the linked device. Throws when not connected. */
export async function sendMessage(phoneNumber: string, message: string): Promise<void> {
  if (!client || state !== 'ready') {
    throw new Error('WhatsApp client is not connected. Open Dashboard → WhatsApp to link the device.')
  }
  const chatId = toChatId(phoneNumber)
  if (!normalizePhone(phoneNumber)) throw new Error('Invalid phone number')
  await client.sendMessage(chatId, message)
}

export function buildCheckInMessage(patientName: string, question: string): string {
  return `Good morning ${patientName}! 👋\n\n${question}\n\nReply to this message with your answer.\n\n_Toju — Your health partner_`
}

function riskRank(risk: string): number {
  return risk === 'red' ? 3 : risk === 'yellow' ? 2 : risk === 'green' ? 1 : 0
}

/**
 * Persists the inbound message first, then triages it. If anything after the
 * first write fails, the message remains in InboundMessage for inspection and
 * retry instead of disappearing with the socket event.
 */
async function handleInboundMessage(message: Message): Promise<void> {
  try {
    if (message.fromMe) return
    const from = message.from ?? ''
    if (!from || from.endsWith('@g.us') || from.includes('status@broadcast') || from.includes('broadcast')) {
      return
    }

    const body = (message.body ?? '').trim() ||
      ((message as unknown as { hasMedia?: boolean }).hasMedia
        ? `[Patient sent a ${message.type || 'media'} message]`
        : '')
    if (!body) return

    const providerMessageId = message.id?._serialized ?? crypto.randomUUID()
    const digits = normalizePhone(from.split('@')[0])
    const phoneNumber = toDisplayPhone(digits)

    const inbound = await InboundMessage.findOneAndUpdate(
      { providerMessageId },
      {
        $setOnInsert: {
          providerMessageId,
          phoneNumber,
          body,
          receivedAt: new Date(),
          processed: false,
        },
      },
      { upsert: true, new: true }
    )

    // Duplicate delivery of a message we already triaged.
    if (inbound.processed) return

    const patient = await Patient.findOne({
      $or: [
        { phoneNumber },
        { phoneNumber: digits },
        { phoneNumber: new RegExp(`${digits}$`) },
      ],
    })

    if (!patient) {
      inbound.doctorId = null
      inbound.patientId = null
      inbound.error = 'No registered patient matches this phone number'
      inbound.processed = true
      inbound.processedAt = new Date()
      await inbound.save()
      return
    }

    inbound.doctorId = patient.doctorId
    inbound.patientId = patient._id
    await inbound.save()

    if (!patient.signal?.approvedAt) {
      await enqueueOutboundMessage({
        idempotencyKey: `unregistered-plan:${providerMessageId}`,
        doctorId: patient.doctorId,
        patientId: patient._id,
        phoneNumber: patient.phoneNumber,
        body: 'Hello! Your care plan is being set up by your doctor. We will reach out to you once everything is ready. 🙏',
        kind: 'triage-reply',
        priority: 60,
      })
      inbound.processed = true
      inbound.processedAt = new Date()
      inbound.error = 'Care signal not approved yet'
      await inbound.save()
      return
    }

    const redFlags = (patient.signal.redFlags ?? []) as string[]
    const medications = (patient.signal.medications ?? []).map(
      (med) => `${med.name} ${med.dose} ${med.frequency}`
    )

    const analysis = await analyzeCheckIn(
      body,
      redFlags,
      patient.name,
      patient.diagnosis,
      medications,
      patient.language
    )

    const checkIn = await CheckIn.create({
      clientId: crypto.randomUUID(),
      patientId: patient._id,
      doctorId: patient.doctorId,
      timestamp: inbound.receivedAt,
      message: body,
      riskScore: analysis.riskScore,
      triggeredFlags: analysis.triggeredFlags,
      botResponse: analysis.botResponse,
      aiStatus: 'ready',
      provenance: analysis.provenance,
      source: 'whatsapp',
      serverVersion: 1,
    })

    const currentRisk = patient.riskScore
    const nextRisk =
      riskRank(analysis.riskScore) >= riskRank(currentRisk) ? analysis.riskScore : currentRisk
    patient.riskScore = nextRisk
    patient.lastCheckIn = new Date()
    patient.serverVersion += 1
    await patient.save()

    if (analysis.riskScore === 'red') {
      await Alert.create({
        clientId: crypto.randomUUID(),
        patientId: patient._id,
        doctorId: patient.doctorId,
        timestamp: new Date(),
        type: 'red_flag',
        message: `RED alert from WhatsApp: ${
          analysis.triggeredFlags.length ? analysis.triggeredFlags.join(', ') : 'urgent symptom'
        } — "${body.slice(0, 160)}"`,
        resolved: false,
        severity: 'critical',
        serverVersion: 1,
      })
    }

    await enqueueOutboundMessage({
      idempotencyKey: `reply:${providerMessageId}`,
      doctorId: patient.doctorId,
      patientId: patient._id,
      phoneNumber: patient.phoneNumber,
      body: analysis.botResponse,
      kind: 'triage-reply',
      priority: analysis.riskScore === 'red' ? 100 : 25,
    })

    inbound.processed = true
    inbound.processedAt = new Date()
    inbound.riskScore = analysis.riskScore
    inbound.triggeredFlags = analysis.triggeredFlags
    inbound.checkInId = checkIn.clientId
    inbound.error = null
    await inbound.save()

    await recordAudit({
      doctorId: String(patient.doctorId),
      actor: 'ai',
      action: 'triage.inbound_completed',
      entityType: 'checkin',
      entityId: checkIn.clientId,
      summary: `WhatsApp triage classified ${patient.name} as ${analysis.riskScore.toUpperCase()}`,
      promptVersion: analysis.provenance.promptVersion,
      model: analysis.provenance.model,
      detail: {
        patientId: patient.clientId,
        riskScore: analysis.riskScore,
        triggeredFlags: analysis.triggeredFlags,
        providerMessageId,
      },
    })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Inbound processing failed'
    console.error('[WA] Inbound processing failed:', messageText)
    // Keep the inbound row unprocessed so it can be retried; never delete it.
    try {
      const providerMessageId = message.id?._serialized
      if (providerMessageId) {
        await InboundMessage.updateOne(
          { providerMessageId },
          { $set: { processed: false, error: messageText } }
        )
      }
    } catch {
      /* ignore secondary failure */
    }
  }
}

export async function initWhatsApp(): Promise<void> {
  if (!env.whatsappEnabled) {
    state = 'disabled'
    console.warn('[WA] Disabled by WHATSAPP_ENABLED=false. Outbound messages remain queued.')
    return
  }
  if (initializing || state === 'ready') return
  initializing = true

  try {
    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'toju',
        dataPath: env.whatsappAuthPath,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        ...(env.whatsappChromePath ? { executablePath: env.whatsappChromePath } : {}),
      },
    })

    client.on('qr', (qr) => {
      latestQr = qr
      state = 'qr'
      lastError = null
      console.log('[WA] QR code generated — link the device from Dashboard → WhatsApp')
    })

    client.on('authenticated', () => {
      latestQr = null
      state = 'starting'
      console.log('[WA] Authenticated; waiting for ready state')
    })

    client.on('auth_failure', (reason) => {
      state = 'auth_failure'
      lastError = typeof reason === 'string' ? reason : 'Authentication failed'
      initializing = false
      console.error('[WA] Authentication failed:', lastError)
    })

    client.on('ready', () => {
      state = 'ready'
      latestQr = null
      lastError = null
      initializing = false
      console.log('[WA] WhatsApp client connected and ready')
      startOutboundProcessor(sendMessage)
    })

    client.on('disconnected', (reason) => {
      state = 'disconnected'
      latestQr = null
      initializing = false
      lastError = typeof reason === 'string' ? reason : 'Disconnected'
      console.warn('[WA] Disconnected:', lastError)
      // Recreate the client after a delay; LocalAuth keeps the session.
      setTimeout(() => {
        if (!initializing && state !== 'ready') void initWhatsApp()
      }, 10_000)
    })

    client.on('message', (message) => {
      void handleInboundMessage(message)
    })

    console.log('[WA] Initializing WhatsApp Web client…')
    await client.initialize()
  } catch (error) {
    state = 'disconnected'
    initializing = false
    lastError = error instanceof Error ? error.message : 'WhatsApp initialization failed'
    console.error('[WA] Failed to initialize:', lastError)
    console.warn('[WA] Server will continue without WhatsApp. Outbound messages stay queued.')
    setTimeout(() => {
      if (!initializing && state !== 'ready') void initWhatsApp()
    }, 15_000)
  }
}
