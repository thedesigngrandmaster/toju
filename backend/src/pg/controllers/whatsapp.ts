import { Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'
import { listOutboundRows, outboxCounts, retryOutbound } from '../repo'

export async function status(_req: AuthRequest, res: Response): Promise<void> {
  const counts = await outboxCounts()
  res.json({
    ready: false,
    state: 'disabled',
    qr: null,
    pendingMessages: counts.pendingMessages,
    failedMessages: counts.failedMessages,
    lastError: counts.lastError,
  })
}

export async function qr(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ ready: false, state: 'disabled', qr: null })
}

export async function outbox(req: AuthRequest, res: Response): Promise<void> {
  const messages = await listOutboundRows(req.doctorId as string, 100)
  const counts = await outboxCounts()
  res.json({
    messages: messages.map((message) => ({
      id: message.id,
      phoneNumber: message.phone_number,
      body: message.body,
      kind: message.kind,
      priority: message.priority,
      status: message.status,
      attempts: message.attempts,
      lastError: message.last_error,
      createdAt: message.created_at,
      sentAt: message.sent_at,
      nextAttemptAt: message.next_attempt_at,
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
