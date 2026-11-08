import { Schema, model, Document, Types } from 'mongoose'
import type { RiskScore } from './Patient'
import { ProvenanceSchema, type IProvenance } from './Provenance'

export interface ICheckIn extends Document {
  clientId: string
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  timestamp: Date
  message: string
  riskScore: RiskScore
  triggeredFlags: string[]
  botResponse: string
  aiStatus: 'idle' | 'queued' | 'processing' | 'ready' | 'error'
  provenance?: IProvenance | null
  source: 'whatsapp' | 'clinician' | 'sync'
  serverVersion: number
  createdAt: Date
  updatedAt: Date
}

const CheckInSchema = new Schema<ICheckIn>(
  {
    clientId: { type: String, required: true, default: () => new Types.ObjectId().toString() },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    timestamp: { type: Date, default: Date.now },
    message: { type: String, required: true },
    riskScore: {
      type: String,
      enum: ['red', 'yellow', 'green', 'unmonitored'],
      required: true,
    },
    triggeredFlags: { type: [String], default: [] },
    botResponse: { type: String, required: true },
    aiStatus: {
      type: String,
      enum: ['idle', 'queued', 'processing', 'ready', 'error'],
      default: 'ready',
    },
    provenance: { type: ProvenanceSchema, default: null },
    source: { type: String, enum: ['whatsapp', 'clinician', 'sync'], default: 'sync' },
    serverVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret.clientId ?? ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)

CheckInSchema.index({ doctorId: 1, clientId: 1 }, { unique: true })
CheckInSchema.index({ patientId: 1, timestamp: -1 })
CheckInSchema.index({ doctorId: 1, updatedAt: -1 })

export const CheckIn = model<ICheckIn>('CheckIn', CheckInSchema)
