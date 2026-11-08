import { Schema, model, Document, Types } from 'mongoose'

export type OutboundKind = 'welcome' | 'checkin' | 'triage-reply' | 'alert' | 'manual'
export type OutboundStatus = 'pending' | 'sending' | 'sent' | 'failed'

/**
 * Durable server-side WhatsApp outbox. Messages are only removed from this
 * collection by a retention job, never because the WhatsApp socket is offline.
 */
export interface IOutboundMessage extends Document {
  /** Unique key supplied by the client operation id or a deterministic job key. */
  idempotencyKey: string
  doctorId: Types.ObjectId
  patientId: Types.ObjectId | null
  phoneNumber: string
  body: string
  kind: OutboundKind
  priority: number
  status: OutboundStatus
  attempts: number
  lastError?: string | null
  nextAttemptAt: Date
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const OutboundMessageSchema = new Schema<IOutboundMessage>(
  {
    idempotencyKey: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
    phoneNumber: { type: String, required: true },
    body: { type: String, required: true },
    kind: {
      type: String,
      enum: ['welcome', 'checkin', 'triage-reply', 'alert', 'manual'],
      required: true,
    },
    priority: { type: Number, default: 20 },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    nextAttemptAt: { type: Date, default: Date.now },
    sentAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = String(ret._id)
        delete ret._id
        delete ret.__v
      },
    },
  }
)

OutboundMessageSchema.index({ idempotencyKey: 1 }, { unique: true })
OutboundMessageSchema.index({ status: 1, nextAttemptAt: 1, priority: -1 })
OutboundMessageSchema.index({ doctorId: 1, createdAt: -1 })

export const OutboundMessage = model<IOutboundMessage>('OutboundMessage', OutboundMessageSchema)
