import { Schema, model, Document, Types } from 'mongoose'
export interface IAlert extends Document {
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  type: 'red_flag' | 'missed_checkin'
  message: string
  resolved: boolean
  resolvedAt?: Date
  timestamp: Date
}
const AlertSchema = new Schema<IAlert>({
  patientId:  { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId:   { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  type:       { type: String, enum: ['red_flag', 'missed_checkin'], required: true },
  message:    { type: String, required: true },
  resolved:   { type: Boolean, default: false },
  resolvedAt: { type: Date, default: null },
  timestamp:  { type: Date, default: Date.now },
})
AlertSchema.index({ doctorId: 1, resolved: 1, timestamp: -1 })
AlertSchema.index({ patientId: 1, resolved: 1 })
export const Alert = model<IAlert>('Alert', AlertSchema)
