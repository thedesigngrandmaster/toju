import Dexie, { type Table } from 'dexie'
import type {
  AiJob,
  Alert,
  AuditEntry,
  CheckIn,
  Note,
  OutboxOperation,
  Patient,
  SyncConflict,
} from '@/types'

export interface MetaRow {
  key: string
  value: string
}

/**
 * Toju local database.
 *
 * The UI reads *only* from this database. Network responses are merged into it
 * by the sync engine. Keeping the schema denormalised (a patient carries its
 * signal) means the patient detail screen can render with a single indexed read
 * — critical on low-end Android devices.
 */
export class TojuDatabase extends Dexie {
  patients!: Table<Patient, string>
  checkIns!: Table<CheckIn, string>
  alerts!: Table<Alert, string>
  notes!: Table<Note, string>
  outbox!: Table<OutboxOperation, string>
  aiQueue!: Table<AiJob, string>
  audit!: Table<AuditEntry, string>
  conflicts!: Table<SyncConflict, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('toju-local')

    this.version(1).stores({
      patients: 'id, doctorId, riskScore, updatedAt, syncState, localOnly',
      checkIns: 'id, patientId, timestamp, riskScore, syncState, type',
      alerts: 'id, patientId, resolved, timestamp, type, syncState',
      notes: 'id, patientId, createdAt, syncState',
      outbox: 'id, status, priority, createdAt, nextAttemptAt, entityId, op',
      aiQueue: 'id, status, kind, patientId, createdAt, nextAttemptAt',
      audit: 'id, timestamp, entityId, action, actor',
      conflicts: 'id, entityId, detectedAt',
      meta: 'key',
    })
  }
}

export const db = new TojuDatabase()

export const nowIso = (): string => new Date().toISOString()

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key)
  return row?.value ?? null
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

export async function getJsonMeta<T>(key: string): Promise<T | null> {
  const raw = await getMeta(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setJsonMeta(key: string, value: unknown): Promise<void> {
  await setMeta(key, JSON.stringify(value))
}

/** Wipes clinical data. Used when a different clinician signs in on a shared device. */
export async function clearClinicalData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.patients, db.checkIns, db.alerts, db.notes, db.outbox, db.aiQueue, db.audit, db.conflicts],
    async () => {
      await Promise.all([
        db.patients.clear(),
        db.checkIns.clear(),
        db.alerts.clear(),
        db.notes.clear(),
        db.outbox.clear(),
        db.aiQueue.clear(),
        db.audit.clear(),
        db.conflicts.clear(),
      ])
    },
  )
  await db.meta.delete('lastSyncAt')
}

export async function storageEstimate(): Promise<{ usage: number; quota: number; percent: number }> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0, percent: 0 }
  const estimate = await navigator.storage.estimate()
  const usage = estimate.usage ?? 0
  const quota = estimate.quota ?? 0
  return { usage, quota, percent: quota ? Math.round((usage / quota) * 100) : 0 }
}

/** Ask the browser for durable storage. iOS may silently deny this. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted?.()) return true
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
