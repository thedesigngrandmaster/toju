import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  getSyncSnapshot,
  refreshSyncCounts,
  subscribeSync,
  syncNow,
} from '@/lib/sync'
import { forceFullSync } from '@/lib/sync'
import { useAuth } from './AuthContext'

interface SyncContextValue {
  status: ReturnType<typeof getSyncSnapshot>['status']
  lastSyncedAt: string | null
  pendingCount: number
  failedCount: number
  aiPending: number
  conflictCount: number
  lastError?: string
  syncing: boolean
  syncNow: () => Promise<void>
  fullSync: () => Promise<void>
  refreshCounts: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const snapshot = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    void (async () => {
      const { startSyncEngine } = await import('@/lib/sync')
      if (!cancelled) startSyncEngine()
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) void refreshSyncCounts()
  }, [isAuthenticated])

  const value = useMemo<SyncContextValue>(
    () => ({
      ...snapshot,
      syncing: snapshot.status === 'syncing',
      syncNow: async () => {
        await syncNow()
        await refreshSyncCounts()
      },
      fullSync: forceFullSync,
      refreshCounts: refreshSyncCounts,
    }),
    [snapshot],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside SyncProvider')
  return ctx
}
