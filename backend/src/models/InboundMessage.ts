import { Schema, model, Document, Types } from 'mongoose'

/**
 * Inbound WhatsApp messages are persisted *before* any AI call. That guarantees
 * a patient message (and therefore a potential RED flag) survives a model
 * outage, a process restart or an out-of-order delivery.
 */
export interface IInboundMessage extends Document {
  providerMessageId: string
  doctorId: Types.ObjectId | null
  patientId: Types.ObjectId | null
  phoneNumber: string
  body: string
  processed: boolean
  riskScore: 'red' | 'yellow' | 'green' | 'unmonitored' | null
  triggeredFlags: string[]
  checkInId: string | null
  error?: string | null
  receivedAt: Date
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const InboundMessageSchema = new Schema<IInboundMessage>(
  {
    providerMessageId: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
    phoneNumber: { type: String, required: true },
    body: { type: String, required: true },
    processed: { type: Boolean, default: false },
    riskScore: {
      type: String,
      enum: ['red', 'yellow', 'green', 'unmonitored', null],
      default: null,
    },
    triggeredFlags: { type: [String], default: [] },
    checkInId: { type: String, default: null },
    error: { type: String, default: null },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

InboundMessageSchema.index({ providerMessageId: 1 }, { unique: true })
InboundMessageSchema.index({ processed: 1, receivedAt: 1 })
InboundMessageSchema.index({ phoneNumber: 1, receivedAt: -1 })

export const InboundMessage = model<IInboundMessage>('InboundMessage', InboundMessageSchema)
