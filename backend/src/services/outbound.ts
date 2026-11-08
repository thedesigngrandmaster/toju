import { Types } from 'mongoose'
import { OutboundMessage, type OutboundKind } from '../models/OutboundMessage'

export interface EnqueueOutboundInput {
  idempotencyKey: string
  doctorId: string | Types.ObjectId
  patientId?: string | Types.ObjectId | null
  phoneNumber: string
  body: string
  kind: OutboundKind
  priority?: number
  nextAttemptAt?: Date
}

export type OutboundSender = (phoneNumber: string, body: string) => Promise<void>

const MAX_ATTEMPTS = 8
const BATCH_SIZE = 20
let timer: ReturnType<typeof setInterval> | null = null
let processing = false

/**
 * Adds a message to the durable WhatsApp outbox. The unique idempotency key
 * makes this safe to call from retried sync operations and model callbacks.
 */
export async function enqueueOutboundMessage(input: EnqueueOutboundInput): Promise<void> {
  const now = new Date()
  await OutboundMessage.updateOne(
    { idempotencyKey: input.idempotencyKey },
    {
      $setOnInsert: {
        idempotencyKey: input.idempotencyKey,
        doctorId: input.doctorId,
        patientId: input.patientId ?? null,
        phoneNumber: input.phoneNumber,
        body: input.body,
        kind: input.kind,
        priority: input.priority ?? (input.kind === 'alert' || input.kind === 'triage-reply' ? 100 : 20),
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: input.nextAttemptAt ?? now,
        sentAt: null,
      },
    },
    { upsert: true }
  )
}

function backoff(attempts: number): Date {
  const delay = Math.min(15 * 60_000, 5_000 * 2 ** Math.min(attempts, 6))
  return new Date(Date.now() + delay)
}

/** Processes due messages. Safe to run concurrently; claims are atomic. */
export async function processOutboundQueue(send: OutboundSender): Promise<void> {
  if (processing) return
  processing = true
  try {
    for (let i = 0; i < BATCH_SIZE; i += 1) {
      const message = await OutboundMessage.findOneAndUpdate(
        { status: 'pending', nextAttemptAt: { $lte: new Date() } },
        { $set: { status: 'sending' } },
        { sort: { priority: -1, createdAt: 1 }, new: true }
      )
      if (!message) break

      try {
        await send(message.phoneNumber, message.body)
        await OutboundMessage.updateOne(
          { _id: message._id },
          { $set: { status: 'sent', sentAt: new Date(), lastError: null } }
        )
      } catch (error) {
        const attempts = message.attempts + 1
        const lastError = error instanceof Error ? error.message : 'WhatsApp send failed'
        await OutboundMessage.updateOne(
          { _id: message._id },
          attempts >= MAX_ATTEMPTS
            ? { $set: { status: 'failed', attempts, lastError } }
            : {
                $set: {
                  status: 'pending',
                  attempts,
                  lastError,
                  nextAttemptAt: backoff(attempts),
                },
              }
        )
        console.error(`[WA-OUTBOX] Delivery failed (${attempts}/${MAX_ATTEMPTS}):`, lastError)
      }
    }
  } finally {
    processing = false
  }
}

/** Starts the retry loop once the WhatsApp client can actually send. */
export function startOutboundProcessor(send: OutboundSender): void {
  if (timer) return
  void processOutboundQueue(send)
  timer = setInterval(() => void processOutboundQueue(send), 5_000)
  console.log('[WA-OUTBOX] Durable outbound processor started')
}

export async function outboxCounts(): Promise<{
  pendingMessages: number
  failedMessages: number
  lastError: string | null
}> {
  const [pendingMessages, failedMessages, lastFailed] = await Promise.all([
    OutboundMessage.countDocuments({ status: { $in: ['pending', 'sending'] } }),
    OutboundMessage.countDocuments({ status: 'failed' }),
    OutboundMessage.findOne({ status: 'failed' }).sort({ updatedAt: -1 }).select('lastError').lean(),
  ])
  return { pendingMessages, failedMessages, lastError: lastFailed?.lastError ?? null }
}

export async function retryOutbound(id: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(id)) return Boolean(await OutboundMessage.findOneAndUpdate(
    { idempotencyKey: id },
    { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null } }
  ))
  const result = await OutboundMessage.updateOne(
    { _id: id },
    { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null } }
  )
  return result.modifiedCount > 0
}
