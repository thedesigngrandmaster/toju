import { Schema, model, Document, Types } from 'mongoose'

export interface IAlert extends Document {
  clientId: string
  patientId: Types.ObjectId
  doctorId: Types.ObjectId
  timestamp: Date
  type: 'red_flag' | 'missed_checkin'
  message: string
  resolved: boolean
  resolvedAt: Date | null
  severity: 'critical' | 'warning'
  serverVersion: number
  createdAt: Date
  updatedAt: Date
}

const AlertSchema = new Schema<IAlert>(
  {
    clientId: { type: String, required: true, default: () => new Types.ObjectId().toString() },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['red_flag', 'missed_checkin'], required: true },
    message: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    severity: { type: String, enum: ['critical', 'warning'], default: 'critical' },
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

AlertSchema.index({ doctorId: 1, clientId: 1 }, { unique: true })
AlertSchema.index({ doctorId: 1, resolved: 1, timestamp: -1 })
AlertSchema.index({ doctorId: 1, updatedAt: -1 })
AlertSchema.index({ patientId: 1, timestamp: -1 })

export const Alert = model<IAlert>('Alert', AlertSchema)
