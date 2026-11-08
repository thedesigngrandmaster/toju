import { db, getMeta } from './db'
import { isOnline } from './network'
import { processAiQueue, pendingAiCount } from './ai'
import { runCoreSync } from './sync-core'

export type EngineStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'auth'

export interface SyncSnapshot {
  status: EngineStatus
  lastSyncedAt: string | null
  pendingCount: number
  failedCount: number
  aiPending: number
  conflictCount: number
  lastError?: string
  lastRunAt?: string
}

const initial: SyncSnapshot = {
  status: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  failedCount: 0,
  aiPending: 0,
  conflictCount: 0,
}

let snapshot: SyncSnapshot = initial
const listeners = new Set<() => void>()
let running: Promise<void> | null = null
let debounceTimer: number | undefined
let intervalTimer: number | undefined
let started = false

function emit(): void {
  listeners.forEach((listener) => listener())
}

function setSnapshot(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  emit()
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncSnapshot(): SyncSnapshot {
  return snapshot
}

export async function refreshSyncCounts(): Promise<void> {
  const [outbox, aiPending, conflicts, lastSyncedAt] = await Promise.all([
    db.outbox.toArray(),
    pendingAiCount(),
    db.conflicts.count(),
    getMeta('lastSyncAt'),
  ])
  const pendingCount = outbox.filter((op) => op.status === 'pending' || op.status === 'syncing').length
  const failedCount = outbox.filter((op) => op.status === 'failed' || op.status === 'conflict').length
  setSnapshot({ pendingCount, failedCount, aiPending, conflictCount: conflicts, lastSyncedAt })
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.ready
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> }
    }).sync
    if (sync) await sync.register('toju-sync')
  } catch {
    // Background Sync is unavailable (all iOS browsers, some WebViews).
  }
}

export async function syncNow(): Promise<void> {
  if (running) return running
  if (!isOnline()) {
    setSnapshot({ status: 'offline' })
    return
  }

  running = (async () => {
    setSnapshot({ status: 'syncing', lastError: undefined })
    const startedAt = Date.now()
    try {
      const report = await runCoreSync()
      // AI queue runs in the foreground only; it is ordered and durable.
      const ai = await processAiQueue()
      await refreshSyncCounts()
      setSnapshot({
        status: report.networkError ? 'offline' : report.authError ? 'auth' : 'idle',
        lastRunAt: new Date().toISOString(),
        lastError: report.authError ? 'Session expired — sign in again to sync.' : undefined,
      })
      if (ai.remaining > 0) setSnapshot({ aiPending: ai.remaining })
      if (report.pushed > 0 || ai.processed > 0) {
        window.dispatchEvent(new CustomEvent('toju:sync-complete', { detail: report }))
      }
      if (ai.processed > 0) {
        window.dispatchEvent(new CustomEvent('toju:ai-processed', { detail: ai }))
      }
      if (report.failed > 0) {
        setSnapshot({ status: 'error', lastError: `${report.failed} operation(s) need attention` })
      }
      if (Date.now() - startedAt > 20_000) {
        console.warn('[sync] Slow sync cycle', Date.now() - startedAt, 'ms')
      }
    } catch (error) {
      setSnapshot({
        status: isOnline() ? 'error' : 'offline',
        lastError: error instanceof Error ? error.message : 'Sync failed',
      })
    } finally {
      running = null
    }
  })()

  return running
}

export function scheduleSync(delayMs = 1_200): void {
  if (typeof window === 'undefined') return
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    void syncNow()
    void registerBackgroundSync()
  }, delayMs)
}

/**
 * Starts connectivity-driven reconciliation. This is the iOS-safe fallback for
 * the missing Background Sync API: whenever the app becomes visible, regains
 * connectivity or is focused, a sync is attempted.
 */
export function startSyncEngine(): () => void {
  if (started) return () => undefined
  started = true

  void refreshSyncCounts()
  if (isOnline()) scheduleSync(500)

  const onOnline = () => {
    setSnapshot({ status: 'idle' })
    scheduleSync(800)
  }
  const onOffline = () => setSnapshot({ status: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleSync(600)
  }
  const onFocus = () => scheduleSync(800)
  const onOutbox = () => {
    void refreshSyncCounts()
    scheduleSync(1_200)
  }
  const onSyncComplete = () => void refreshSyncCounts()

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)
  window.addEventListener('toju:outbox-changed', onOutbox)
  window.addEventListener('toju:sync-complete', onSyncComplete)

  intervalTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && isOnline()) void syncNow()
  }, 60_000)

  return () => {
    started = false
    window.clearTimeout(debounceTimer)
    window.clearInterval(intervalTimer)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('toju:outbox-changed', onOutbox)
    window.removeEventListener('toju:sync-complete', onSyncComplete)
  }
}

/** Force a full pull (used after sign-in or from Settings). */
export async function forceFullSync(): Promise<void> {
  await db.meta.delete('lastSyncAt')
  await syncNow()
}
