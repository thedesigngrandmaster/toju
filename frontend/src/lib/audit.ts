import { db, nowIso } from './db'
import { getDeviceId } from './auth-store'
import { uuid } from './utils'
import type { AuditEntry } from '@/types'

type AuditInput = Omit<AuditEntry, 'id' | 'timestamp' | 'deviceId'> & {
  timestamp?: string
}

/**
 * Append-only local audit trail.
 *
 * Every AI decision and every clinician mutation is recorded here before the
 * UI is allowed to show success. The log survives app restarts because it lives
 * in IndexedDB, and it is exported from Settings for compliance review.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  const deviceId = await getDeviceId().catch(() => 'unknown')
  await db.audit.add({
    ...input,
    id: uuid(),
    timestamp: input.timestamp ?? nowIso(),
    deviceId,
  })
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  return db.audit.orderBy('timestamp').reverse().limit(limit).toArray()
}

export async function exportAuditJson(): Promise<string> {
  const entries = await db.audit.orderBy('timestamp').toArray()
  return JSON.stringify(
    {
      exportedAt: nowIso(),
      application: 'Toju',
      schemaVersion: 1,
      entries,
    },
    null,
    2,
  )
}
