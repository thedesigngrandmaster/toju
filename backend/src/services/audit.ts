import { AuditLog } from '../models/AuditLog'

export interface AuditInput {
  doctorId: string
  actor: 'clinician' | 'system' | 'ai'
  action: string
  entityType: string
  entityId: string
  summary: string
  detail?: Record<string, unknown>
  promptVersion?: string
  model?: string
  deviceId?: string
  timestamp?: Date
}

/**
 * Server-side audit trail. The PWA keeps its own append-only local log; this is
 * the authoritative copy used for cross-device compliance review.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      doctorId: input.doctorId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      detail: input.detail,
      promptVersion: input.promptVersion,
      aiModel: input.model,
      deviceId: input.deviceId,
      timestamp: input.timestamp ?? new Date(),
    })
  } catch (error) {
    // Audit failures must never break a clinical write. Log loudly instead.
    console.error('[AUDIT] Failed to persist audit entry:', error)
  }
}
