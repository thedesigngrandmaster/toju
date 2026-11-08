import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CloudOff,
  Cpu,
  Database,
  Download,
  HardDrive,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useInstallState } from '@/hooks/useInstallState'
import { storageEstimate, requestPersistentStorage } from '@/lib/db'
import { setSimulatedOffline, supportsBackgroundSync } from '@/lib/network'
import { promptInstall, isIos, isStandalone } from '@/lib/pwa'
import { CLOUD_MODEL, SIGNAL_PROMPT_VERSION, TRIAGE_PROMPT_VERSION } from '@/lib/ai'
import { OFFLINE_TRIAGE_PROMPT_VERSION } from '@/lib/triage'
import { Button } from '@/components/ui/Button'
import { SyncBadge } from '@/components/ui/SyncBadge'
import { Modal } from '@/components/ui/Modal'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { toast } from '@/lib/toast'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export default function SettingsView() {
  const { doctor, logout, wipeLocalData } = useAuth()
  const sync = useSync()
  const network = useNetworkStatus()
  const installState = useInstallState()

  const [storage, setStorage] = useState<{ usage: number; quota: number; percent: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [working, setWorking] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)

  const simulatedOffline = network === 'simulated-offline'
  const online = network === 'online'

  useEffect(() => {
    void (async () => {
      const estimate = await storageEstimate()
      setStorage(estimate)
      try {
        setPersisted((await navigator.storage?.persisted?.()) ?? false)
      } catch {
        setPersisted(false)
      }
    })()
  }, [])

  async function toggleSimulation() {
    setSimulatedOffline(!simulatedOffline)
    if (simulatedOffline) {
      toast.success('Back online', 'Syncing your queued changes now.')
      await sync.syncNow()
    } else {
      toast.info('Offline simulation enabled', 'Every write is saved locally. Sync is paused until you switch back.')
    }
  }

  async function handlePersist() {
    setWorking(true)
    try {
      const granted = await requestPersistentStorage()
      setPersisted(granted)
      if (granted) toast.success('Storage protected', 'The browser will avoid evicting Toju data.')
      else toast.info('Storage request declined', 'Keep the app installed and open it regularly to protect data.')
    } finally {
      setWorking(false)
    }
  }

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === 'unavailable') {
      toast.info(
        'Install from your browser menu',
        isIos()
          ? 'On iPhone or iPad, use Share → Add to Home Screen in Safari.'
          : 'Look for “Install app” in your browser menu.',
      )
    } else if (outcome === 'accepted') {
      toast.success('Toju installed')
    }
  }

  async function confirmWipe() {
    setWorking(true)
    try {
      await wipeLocalData()
      setWipeOpen(false)
    } finally {
      setWorking(false)
    }
  }

  const installLabel =
    installState === 'installed'
      ? 'Installed'
      : installState === 'installable'
        ? 'Ready to install'
        : installState === 'ios'
          ? 'Add to Home Screen'
          : 'Browser app'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Offline storage, sync diagnostics and device controls
        </p>
      </div>

      <section className="rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {doctor?.name
              ?.split(' ')
              .filter((part) => !part.includes('.'))
              .slice(0, 2)
              .map((part) => part[0])
              .join('') || 'DR'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{doctor?.name ?? 'Clinician'}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {doctor?.specialty}
              {doctor?.hospital ? ` · ${doctor.hospital}` : ''}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{doctor?.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void logout()} startIcon={<LogOut className="size-3.5" />}>
            Sign out
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            {online ? <Wifi className="size-4 text-success" /> : <WifiOff className="size-4 text-warning" />}
            <p className="text-sm font-medium text-muted-foreground">Connectivity</p>
            <span className="ml-auto">
              <SyncBadge />
            </span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Connection</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {network === 'simulated-offline'
                    ? 'Simulated offline for testing'
                    : network === 'offline'
                      ? 'Device reports no network'
                      : network === 'unreachable'
                        ? 'Server unreachable — working locally'
                        : 'Connected to the Toju API'}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  online ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning',
                )}
              >
                {online ? 'online' : 'offline'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void toggleSimulation()}
              className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="text-xs font-medium text-foreground">Simulate offline mode</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  Test local reads, queued AI jobs and the outbox without losing data.
                </p>
              </div>
              <span
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
                  simulatedOffline ? 'bg-warning' : 'bg-secondary',
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
                    simulatedOffline ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </span>
            </button>

            <div className="flex items-start gap-2 rounded-lg bg-secondary/30 px-3 py-2">
              <CloudOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {supportsBackgroundSync()
                  ? 'This browser supports Background Sync. Clinical changes can sync when the app is closed.'
                  : 'Background Sync is unavailable (typical on iOS). Toju syncs when the app is open, focused or reconnected.'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <RefreshCw className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Sync engine</p>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {sync.lastSyncedAt ? `Last pull ${timeAgo(sync.lastSyncedAt)}` : 'Never synced'}
            </span>
          </div>
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className="text-base font-semibold text-foreground">{sync.pendingCount}</p>
                <p className="text-[10px] text-muted-foreground">To sync</p>
              </div>
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className="text-base font-semibold text-foreground">{sync.aiPending}</p>
                <p className="text-[10px] text-muted-foreground">AI queued</p>
              </div>
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className={cn('text-base font-semibold', sync.failedCount ? 'text-destructive' : 'text-foreground')}>
                  {sync.failedCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Issues</p>
              </div>
            </div>

            {sync.lastError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-danger-bg px-3 py-2 text-[10px] text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                {sync.lastError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void sync.syncNow()}
                loading={sync.syncing}
                disabled={!online}
                startIcon={!sync.syncing ? <RefreshCw className="size-3.5" /> : undefined}
              >
                Sync now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void sync.fullSync()}
                disabled={!online || sync.syncing}
              >
                Full re-download
              </Button>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Push uses idempotent operation IDs. Pull is a delta from the server cursor. Clinician edits win
              conflicts; every conflict is recorded in the audit trail.
            </p>
          </div>
        </section>

        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <Database className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Local database</p>
            <span className="ml-auto text-[10px] text-muted-foreground">IndexedDB</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {storage ? `${formatBytes(storage.usage)} used` : 'Calculating…'}
                  </span>
                  <span className="text-muted-foreground">
                    {storage?.quota ? `${formatBytes(storage.quota)} available` : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(2, storage?.percent ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Persistent storage</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {persisted === null ? 'Checking…' : persisted ? 'Granted — data is protected' : 'Not granted'}
                </p>
              </div>
              {!persisted && (
                <Button size="sm" variant="outline" onClick={() => void handlePersist()} loading={working}>
                  Request
                </Button>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-secondary/30 px-3 py-2">
              <HardDrive className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Patient records, alerts, notes, queued AI jobs and the audit log live on this device. Clearing
                browser data removes them.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border">
          <div className="flex items-center gap-2 border-b p-4">
            <Smartphone className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Installation</p>
            <span className="ml-auto text-[10px] text-muted-foreground">{installLabel}</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Home screen app</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {isStandalone()
                    ? 'Running in standalone mode'
                    : installState === 'ios'
                      ? 'Safari Share → Add to Home Screen'
                      : 'Install for full-screen, offline access'}
                </p>
              </div>
              {installState !== 'installed' && (
                <Button size="sm" variant="outline" onClick={() => void handleInstall()} startIcon={<Download className="size-3.5" />}>
                  Install
                </Button>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-secondary/30 px-3 py-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                The service worker caches the app shell. Clinical API responses are never cached — the local
                database is the source of truth.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border">
        <div className="flex items-center gap-2 border-b p-4">
          <Cpu className="size-4 text-info" />
          <p className="text-sm font-medium text-muted-foreground">AI configuration</p>
        </div>
        <dl className="grid grid-cols-1 gap-3 p-4 text-[11px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Cloud model</dt>
            <dd className="mt-0.5 font-mono text-foreground">{CLOUD_MODEL}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Offline triage</dt>
            <dd className="mt-0.5 font-mono text-foreground">{OFFLINE_TRIAGE_PROMPT_VERSION}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Signal prompt</dt>
            <dd className="mt-0.5 font-mono text-foreground">{SIGNAL_PROMPT_VERSION}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Triage prompt</dt>
            <dd className="mt-0.5 font-mono text-foreground">{TRIAGE_PROMPT_VERSION}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-destructive/20">
        <div className="flex items-center gap-2 border-b border-destructive/20 p-4">
          <Trash2 className="size-4 text-destructive" />
          <p className="text-sm font-medium text-destructive">Danger zone</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Wipe local patient data</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Removes cached patients, alerts, notes, queues and audit entries from this device. Use this
              before handing the device to another clinician.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setWipeOpen(true)} disabled={working}>
            Wipe data
          </Button>
        </div>
      </section>

      <p className="pb-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        Toju offline-first PWA · local-first clinical data · {formatDateTime(new Date().toISOString())}
      </p>

      <Modal
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title="Wipe local patient data?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setWipeOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => void confirmWipe()} loading={working}>
              Wipe everything
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            This cannot be undone. Records that have not synced yet will be permanently lost. Make sure you
            are online and synced before continuing.
          </p>
          <div className="rounded-lg bg-danger-bg px-3 py-2 text-[11px] leading-relaxed text-destructive">
            Unsynced changes: {sync.pendingCount} operation{sync.pendingCount === 1 ? '' : 's'} ·{' '}
            {sync.aiPending} AI job{sync.aiPending === 1 ? '' : 's'} queued.
          </div>
        </div>
      </Modal>
    </div>
  )
}
