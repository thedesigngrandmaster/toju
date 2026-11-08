import { db, nowIso } from './db'
import { logAudit } from './audit'
import { uuid } from './utils'
import type {
  Alert,
  CheckIn,
  ClinicalSignal,
  Note,
  OutboxOperation,
  Patient,
  PatientDetailDTO,
  SyncPullResponse,
  SyncPushResult,
} from '@/types'

function normalizeSignal(signal: PatientDetailDTO['signal']): ClinicalSignal | null {
  if (!signal) return null
  return {
    ...signal,
    medications: (signal.medications ?? []).map((med, index) => ({
      ...med,
      id: med.id || `med-${index}`,
      confidence: med.confidence ?? signal.confidence ?? 0,
    })),
    monitoringSchedule: (signal.monitoringSchedule ?? []).map((item, index) => ({
      ...item,
      id: item.id || `mon-${index}`,
    })),
    redFlags: signal.redFlags ?? [],
    rawNotes: signal.rawNotes ?? '',
  }
}

export function remotePatientToLocal(dto: PatientDetailDTO, existing?: Patient): Patient {
  const signal = normalizeSignal(dto.signal)
  const createdAt = dto.createdAt ?? existing?.createdAt ?? nowIso()
  return {
    id: dto.id,
    doctorId: dto.doctorId,
    name: dto.name,
    age: dto.age ?? 0,
    diagnosis: dto.diagnosis,
    admittedDate: dto.admittedDate?.slice(0, 10) ?? existing?.admittedDate ?? '',
    dischargedDate: dto.dischargedDate?.slice(0, 10) ?? existing?.dischargedDate ?? '',
    riskScore: dto.riskScore,
    phoneNumber: dto.phoneNumber,
    language: dto.language ?? 'english',
    lastCheckIn: dto.lastCheckIn ?? null,
    signal,
    signalRawNotes: signal?.rawNotes ?? existing?.signalRawNotes ?? null,
    aiStatus: existing?.aiStatus === 'queued' || existing?.aiStatus === 'processing'
      ? existing.aiStatus
      : signal
        ? 'ready'
        : 'idle',
    createdAt,
    updatedAt: dto.updatedAt ?? existing?.updatedAt ?? nowIso(),
    serverVersion: dto.serverVersion ?? existing?.serverVersion ?? 1,
    syncState: 'synced',
    localOnly: false,
  }
}

export async function pendingOpsFor(entityId: string): Promise<OutboxOperation[]> {
  return db.outbox.where('entityId').equals(entityId).toArray()
}

export async function hasPendingOps(entityId: string): Promise<boolean> {
  const ops = await pendingOpsFor(entityId)
  return ops.some((op) => op.status === 'pending' || op.status === 'syncing' || op.status === 'conflict')
}

export async function recordConflict(input: {
  entityType: string
  entityId: string
  resolution: string
  localOperationId?: string
  serverVersion: number
  detail?: Record<string, unknown>
}): Promise<void> {
  await db.conflicts.add({
    id: uuid(),
    entityType: input.entityType,
    entityId: input.entityId,
    detectedAt: nowIso(),
    resolution: input.resolution,
    localOperationId: input.localOperationId,
    serverVersion: input.serverVersion,
    detail: input.detail,
  })
  await logAudit({
    actor: 'system',
    action: 'sync.conflict',
    entityType: input.entityType,
    entityId: input.entityId,
    summary: `Conflict detected — ${input.resolution}`,
    detail: input.detail,
  })
}

/**
 * Applies a server patient unless the local device has unsynced clinician edits.
 * Conflict policy: a clinician's local edit wins and is pushed on the next sync.
 * The conflict is still recorded so that nothing is silently overwritten.
 */
export async function applyRemotePatient(
  dto: PatientDetailDTO,
  options: { force?: boolean } = {},
): Promise<boolean> {
  const existing = await db.patients.get(dto.id)
  const pending = await pendingOpsFor(dto.id)

  if (pending.length > 0 && !options.force) {
    const serverVersion = dto.serverVersion ?? existing?.serverVersion ?? 1
    if (!existing || serverVersion > existing.serverVersion) {
      await recordConflict({
        entityType: 'patient',
        entityId: dto.id,
        resolution: 'clinician-local-edit-wins',
        localOperationId: pending[0]?.id,
        serverVersion,
        detail: { localVersion: existing?.serverVersion, pendingOps: pending.map((op) => op.op) },
      })
    }
    return false
  }

  const local = remotePatientToLocal(dto, existing)
  await db.patients.put(local)

  // Nested records from the detail endpoint.
  if (dto.alerts) await applyRemoteAlerts(dto.alerts)
  if (dto.checkIns) await applyRemoteCheckIns(dto.checkIns)
  if (dto.notes) await applyRemoteNotes(dto.notes)
  return true
}

export async function applyRemoteAlert(alert: Alert, options: { force?: boolean } = {}): Promise<boolean> {
  const pending = await pendingOpsFor(alert.id)
  if (pending.length > 0 && !options.force) return false
  await db.alerts.put({ ...alert, syncState: 'synced', severity: alert.severity ?? (alert.type === 'red_flag' ? 'critical' : 'warning') })
  return true
}

export async function applyRemoteCheckIn(checkIn: CheckIn, options: { force?: boolean } = {}): Promise<boolean> {
  const pending = await pendingOpsFor(checkIn.id)
  if (pending.length > 0 && !options.force) return false
  await db.checkIns.put({ ...checkIn, syncState: 'synced' })
  return true
}

export async function applyRemoteNote(note: Note, options: { force?: boolean } = {}): Promise<boolean> {
  const pending = await pendingOpsFor(note.id)
  if (pending.length > 0 && !options.force) return false
  await db.notes.put({ ...note, syncState: 'synced' })
  return true
}

async function applyRemoteAlerts(alerts: Alert[]): Promise<void> {
  for (const alert of alerts) await applyRemoteAlert(alert)
}

async function applyRemoteCheckIns(checkIns: CheckIn[]): Promise<void> {
  for (const checkIn of checkIns) await applyRemoteCheckIn(checkIn)
}

async function applyRemoteNotes(notes: Note[]): Promise<void> {
  for (const note of notes) await applyRemoteNote(note)
}

/**
 * Pull merge. Server data is authoritative *except* for entities with pending
 * local operations. Those local edits are preserved and pushed next.
 */
export async function mergePull(response: SyncPullResponse): Promise<{ applied: number; preserved: number }> {
  let applied = 0
  let preserved = 0

  for (const dto of response.patients) {
    const changed = await applyRemotePatient(dto)
    if (changed) applied += 1
    else preserved += 1
  }
  for (const alert of response.alerts) {
    if (await applyRemoteAlert(alert)) applied += 1
    else preserved += 1
  }
  for (const checkIn of response.checkIns) {
    if (await applyRemoteCheckIn(checkIn)) applied += 1
    else preserved += 1
  }
  for (const note of response.notes) {
    if (await applyRemoteNote(note)) applied += 1
    else preserved += 1
  }

  return { applied, preserved }
}

/**
 * Applies the canonical record returned by a push. Called after the operation
 * itself has been removed from the outbox.
 */
export async function mergePushResult(result: SyncPushResult): Promise<void> {
  if (result.patient) {
    await applyRemotePatient(result.patient, { force: true })
  }
  if (result.alert) await applyRemoteAlert(result.alert, { force: true })
  if (result.checkIn) await applyRemoteCheckIn(result.checkIn, { force: true })
  if (result.note) await applyRemoteNote(result.note, { force: true })
}
