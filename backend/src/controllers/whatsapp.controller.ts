import { Response } from 'express'
import QRCode from 'qrcode'
import { OutboundMessage } from '../models/OutboundMessage'
import {
  getLatestQr,
  getWhatsAppLastError,
  getWhatsAppState,
  isWhatsAppReady,
} from '../services/whatsapp'
import { outboxCounts, retryOutbound } from '../services/outbound'
import type { AuthRequest } from '../middleware/auth'

export async function status(_req: AuthRequest, res: Response): Promise<void> {
  const counts = await outboxCounts()
  res.json({
    ready: isWhatsAppReady(),
    state: getWhatsAppState(),
    qr: null,
    pendingMessages: counts.pendingMessages,
    failedMessages: counts.failedMessages,
    lastError: getWhatsAppLastError() ?? counts.lastError,
  })
}

export async function qr(_req: AuthRequest, res: Response): Promise<void> {
  const ready = isWhatsAppReady()
  const raw = getLatestQr()
  if (ready || !raw) {
    res.json({ ready, state: getWhatsAppState(), qr: null })
    return
  }
  try {
    const dataUrl = await QRCode.toDataURL(raw, { width: 320, margin: 2 })
    res.json({ ready: false, state: getWhatsAppState(), qr: dataUrl })
  } catch {
    res.json({ ready: false, state: getWhatsAppState(), qr: null })
  }
}

export async function outbox(req: AuthRequest, res: Response): Promise<void> {
  const messages = await OutboundMessage.find({ doctorId: req.doctorId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  const counts = await outboxCounts()
  res.json({
    messages: messages.map((message) => ({
      id: String(message._id),
      phoneNumber: message.phoneNumber,
      body: message.body,
      kind: message.kind,
      priority: message.priority,
      status: message.status,
      attempts: message.attempts,
      lastError: message.lastError ?? null,
      createdAt: message.createdAt,
      sentAt: message.sentAt ?? null,
      nextAttemptAt: message.nextAttemptAt,
    })),
    counts,
  })
}

export async function retry(req: AuthRequest, res: Response): Promise<void> {
  const ok = await retryOutbound(req.params.id)
  if (!ok) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found' } })
    return
  }
  res.json({ ok: true })
}
