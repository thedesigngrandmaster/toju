import { Schema, model, Document, Types } from 'mongoose'

export interface IAlert extends Document {
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  timestamp: Date
  type: 'red_flag' | 'missed_checkin'
  message: string
  resolved: boolean
  resolvedAt: Date | null
}

const AlertSchema = new Schema<IAlert>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['red_flag', 'missed_checkin'], required: true },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)

AlertSchema.index({ doctorId: 1, resolved: 1, timestamp: -1 })

export const Alert = model<IAlert>('Alert', AlertSchema)
