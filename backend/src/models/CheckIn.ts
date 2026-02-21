import { Schema, model, Document, Types } from 'mongoose'
import type { RiskScore } from './Patient'

export interface ICheckIn extends Document {
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  timestamp: Date
  message: string
  riskScore: RiskScore
  triggeredFlags: string[]
  botResponse: string
}

const CheckInSchema = new Schema<ICheckIn>(
  {
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
  },
  { timestamps: false }
)

CheckInSchema.index({ patientId: 1, timestamp: -1 })

export const CheckIn = model<ICheckIn>('CheckIn', CheckInSchema)
