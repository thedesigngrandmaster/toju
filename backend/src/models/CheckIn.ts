import { Schema, model, Document, Types } from 'mongoose'
export interface ICheckIn extends Document {
  patientId: Types.ObjectId
  message: string
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
  timestamp: Date
}
const CheckInSchema = new Schema<ICheckIn>({
  patientId:      { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  message:        { type: String, required: true },
  riskScore:      { type: String, enum: ['red', 'yellow', 'green'], required: true },
  triggeredFlags: [String],
  botResponse:    { type: String, required: true },
  timestamp:      { type: Date, default: Date.now },
})
CheckInSchema.index({ patientId: 1, timestamp: -1 })
export const CheckIn = model<ICheckIn>('CheckIn', CheckInSchema)
