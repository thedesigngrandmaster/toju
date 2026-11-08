import { Schema, model, Document, Types } from 'mongoose'

export type SyncOperationStatus = 'applied' | 'duplicate' | 'conflict' | 'retry' | 'rejected'

/**
 * Idempotency ledger for client outbox operations. A mobile client may retry a
 * batch after a timeout; the operation id guarantees it is applied exactly once.
 */
export interface ISyncOperation extends Document {
  operationId: string
  doctorId: Types.ObjectId
  deviceId: string
  entityType: string
  entityId: string
  op: string
  status: SyncOperationStatus
  result: Record<string, unknown>
  error?: string
  createdAt: Date
  appliedAt: Date
}

const SyncOperationSchema = new Schema<ISyncOperation>(
  {
    operationId: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    deviceId: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    op: { type: String, required: true },
    status: { type: String, required: true },
    result: { type: Schema.Types.Mixed, default: {} },
    error: String,
    createdAt: { type: Date, default: Date.now },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

SyncOperationSchema.index({ doctorId: 1, operationId: 1 }, { unique: true })
SyncOperationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

export const SyncOperation = model<ISyncOperation>('SyncOperation', SyncOperationSchema)
