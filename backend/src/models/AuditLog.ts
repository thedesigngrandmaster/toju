import { Schema, model, Types } from 'mongoose'

export interface IAuditLog {
  doctorId: Types.ObjectId
  actor: 'clinician' | 'system' | 'ai'
  action: string
  entityType: string
  entityId: string
  summary: string
  detail?: Record<string, unknown>
  promptVersion?: string
  aiModel?: string
  deviceId?: string
  timestamp: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    actor: { type: String, enum: ['clinician', 'system', 'ai'], required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    summary: { type: String, required: true },
    detail: { type: Schema.Types.Mixed },
    promptVersion: String,
    aiModel: String,
    deviceId: String,
    timestamp: { type: Date, default: Date.now },
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

AuditLogSchema.index({ doctorId: 1, timestamp: -1 })
AuditLogSchema.index({ doctorId: 1, entityType: 1, entityId: 1 })

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema)
