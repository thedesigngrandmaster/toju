import { api, ApiError } from './api'
import { db, getMeta, nowIso, setMeta } from './db'
import { getDeviceId, getIndexedToken, getToken, setToken } from './auth-store'
import { logAudit } from './audit'
import {
  applyRemotePatient,
  mergePull,
  mergePushResult,
  pendingOpsFor,
  recordConflict,
} from './merge'
import type { OutboxOperation, SyncPushOperation, SyncPushResult } from '@/types'

export interface CoreSyncReport {
  pushed: number
  pulled: number
  conflicts: number
  failed: number
  retrying: number
  networkError?: boolean
  authError?: boolean
  at: string
}

let coreInFlight: Promise<CoreSyncReport> | null = null

/** The service worker has no localStorage, so hydrate the access token from IDB. */
export async function hydrateAuthForWorker(): Promise<boolean> {
  if (getToken()) return true
  const token = await getIndexedToken()
  if (!token) return false
  await setToken(token)
  return true
}

function backoffMs(attempts: number, priority: number): number {
  const base = priority >= 90 ? 2_000 : 5_000
  return Math.min(120_000, base * 2 ** Math.min(attempts, 5))
}

async function resetOps(ops: OutboxOperation[], error: string): Promise<void> {
  const now = Date.now()
  for (const op of ops) {
    const attempts = op.attempts + 1
    await db.outbox.update(op.id, {
      status: 'pending',
      attempts,
      lastError: error,
      nextAttemptAt: new Date(now + backoffMs(attempts, op.priority)).toISOString(),
    })
  }
}

async function markEntitySynced(entityType: string, entityId: string): Promise<void> {
  const remaining = await pendingOpsFor(entityId)
  if (remaining.length > 0) return
  if (entityType === 'patient' || entityType === 'signal') {
    await db.patients.update(entityId, { syncState: 'synced', localOnly: false })
  } else if (entityType === 'alert') {
    await db.alerts.update(entityId, { syncState: 'synced' })
  } else if (entityType === 'note') {
    await db.notes.update(entityId, { syncState: 'synced' })
  } else if (entityType === 'checkin') {
    await db.checkIns.update(entityId, { syncState: 'synced' })
  }
}

async function handlePushResult(op: OutboxOperation, result: SyncPushResult): Promise<{
  pushed: number
  conflicts: number
  failed: number
  retrying: number
}> {
  if (result.status === 'applied' || result.status === 'duplicate' || result.status === 'conflict') {
    await db.outbox.delete(op.id)
    if (result.status === 'conflict' || result.conflictResolved) {
      await recordConflict({
        entityType: op.entityType,
        entityId: op.entityId,
        resolution: 'clinician-local-edit-wins',
        localOperationId: op.id,
        serverVersion: result.serverVersion ?? op.baseVersion + 1,
        detail: { op: op.op, serverVersion: result.serverVersion },
      })
    }
    await mergePushResult(result)
    await markEntitySynced(op.entityType, op.entityId)
    return { pushed: 1, conflicts: result.status === 'conflict' ? 1 : 0, failed: 0, retrying: 0 }
  }

  if (result.status === 'retry') {
    const attempts = op.attempts + 1
    await db.outbox.update(op.id, {
      status: 'pending',
      attempts,
      lastError: result.error ?? 'Server asked client to retry',
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts, op.priority)).toISOString(),
    })
    return { pushed: 0, conflicts: 0, failed: 0, retrying: 1 }
  }

  // Rejected operations are never deleted: the clinician's data stays visible
  // locally and the failure is surfaced in the sync diagnostics screen.
  await db.outbox.update(op.id, {
    status: 'failed',
    attempts: op.attempts + 1,
    lastError: result.error ?? 'Operation rejected by server',
  })
  if (op.entityType === 'patient') {
    await db.patients.update(op.entityId, { syncState: 'error' })
  }
  await logAudit({
    actor: 'system',
    action: 'sync.operation_rejected',
    entityType: op.entityType,
    entityId: op.entityId,
    summary: `Server rejected ${op.op}: ${result.error ?? 'unknown error'}`,
    detail: { operationId: op.id },
  })
  return { pushed: 0, conflicts: 0, failed: 1, retrying: 0 }
}

/**
 * Pushes due outbox operations in priority order. Called by the app sync loop,
 * the Background Sync service worker and the manual "Sync now" button.
 */
export async function pushOutbox(): Promise<{
  pushed: number
  conflicts: number
  failed: number
  retrying: number
  networkError?: boolean
  authError?: boolean
}> {
  const report = { pushed: 0, conflicts: 0, failed: 0, retrying: 0 } as {
    pushed: number
    conflicts: number
    failed: number
    retrying: number
    networkError?: boolean
    authError?: boolean
  }

  const deviceId = await getDeviceId()

  for (let batch = 0; batch < 6; batch += 1) {
    const now = nowIso()
    const due = (await db.outbox.where('status').equals('pending').toArray())
      .filter((op) => op.nextAttemptAt <= now)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))
      .slice(0, 40)

    if (due.length === 0) break

    for (const op of due) {
      await db.outbox.update(op.id, { status: 'syncing' })
    }

    const operations: SyncPushOperation[] = due.map((op) => ({
      id: op.id,
      entityType: op.entityType,
      entityId: op.entityId,
      op: op.op,
      payload: op.payload,
      baseVersion: op.baseVersion,
      clientTimestamp: op.clientTimestamp,
    }))

    let response: Awaited<ReturnType<typeof api.sync.push>>
    try {
      response = await api.sync.push(deviceId, operations)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      await resetOps(due, message)
      if (err instanceof ApiError && err.isAuthError) {
        report.authError = true
      } else {
        report.networkError = true
      }
      break
    }

    const byId = new Map(response.results.map((result) => [result.id, result]))
    for (const op of due) {
      const result = byId.get(op.id)
      if (!result) {
        await db.outbox.update(op.id, { status: 'pending', lastError: 'No server result' })
        report.retrying += 1
        continue
      }
      try {
        const partial = await handlePushResult(op, result)
        report.pushed += partial.pushed
        report.conflicts += partial.conflicts
        report.failed += partial.failed
        report.retrying += partial.retrying
      } catch (err) {
        await resetOps([op], err instanceof Error ? err.message : 'Merge failed')
        report.retrying += 1
      }
    }

    await setMeta('lastPushAt', nowIso())
    if (due.length < 40) break
  }

  return report
}

/** Pulls delta records since the last server cursor, following pagination. */
export async function pullDelta(): Promise<{ applied: number; preserved: number }> {
  const since = await getMeta('lastSyncAt')
  let cursor = since
  let applied = 0
  let preserved = 0

  for (let page = 0; page < 20; page += 1) {
    const response = await api.sync.pull(cursor)
    const merged = await mergePull(response)
    applied += merged.applied
    preserved += merged.preserved
    await setMeta('lastSyncAt', response.serverTime)
    cursor = response.serverTime
    if (!response.hasMore) break
  }

  return { applied, preserved }
}

/**
 * Complete sync cycle used by both the foreground app and the service worker.
 * AI queue processing is intentionally left to the foreground app (it involves
 * UI state), but all clinical mutations are pushed here.
 */
export async function runCoreSync(): Promise<CoreSyncReport> {
  if (coreInFlight) return coreInFlight

  coreInFlight = (async () => {
    const at = nowIso()
    const report: CoreSyncReport = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      failed: 0,
      retrying: 0,
      at,
    }

    const authed = await hydrateAuthForWorker()
    if (!authed) {
      report.authError = true
      return report
    }

    const push = await pushOutbox()
    report.pushed = push.pushed
    report.conflicts = push.conflicts
    report.failed = push.failed
    report.retrying = push.retrying
    report.networkError = push.networkError
    report.authError = push.authError

    if (push.networkError || push.authError) return report

    try {
      const pull = await pullDelta()
      report.pulled = pull.applied
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) report.networkError = true
      else if (err instanceof ApiError && err.isAuthError) report.authError = true
      else report.failed += 1
    }

    return report
  })()

  try {
    return await coreInFlight
  } finally {
    coreInFlight = null
  }
}

/** Refresh a single patient from the server (detail screen optimisation). */
export async function refreshPatientFromServer(patientId: string): Promise<boolean> {
  try {
    const dto = await api.patients.get(patientId)
    return await applyRemotePatient(dto)
  } catch {
    return false
  }
}
