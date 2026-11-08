import { CloudOff, Database, Loader2, WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSync } from '@/context/SyncContext'
import { cn } from '@/lib/utils'

export function OfflineBanner({ className }: { className?: string }) {
  const network = useNetworkStatus()
  const { pendingCount, aiPending, syncing, failedCount, syncNow } = useSync()

  if (network === 'online' && pendingCount === 0 && aiPending === 0 && !syncing && failedCount === 0) {
    return null
  }

  const offline = network !== 'online'
  const Icon = offline ? (network === 'simulated-offline' ? CloudOff : WifiOff) : syncing ? Loader2 : Database

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
        offline
          ? 'border-warning/25 bg-warning-bg text-warning'
          : failedCount > 0
            ? 'border-destructive/20 bg-danger-bg text-destructive'
            : 'border-info/20 bg-info-bg text-info',
        className,
      )}
      role="status"
    >
      <Icon className={cn('size-3.5 shrink-0', syncing && 'animate-spin')} />
      <p className="flex-1">
        {network === 'simulated-offline' ? (
          <>
            <strong>Offline simulation is on.</strong> Changes are saved to this device.
          </>
        ) : offline ? (
          <>
            <strong>Offline mode.</strong> You can view, edit, triage and write notes.
            {pendingCount > 0 ? ` ${pendingCount} change${pendingCount === 1 ? '' : 's'} saved locally.` : ''}
            {aiPending > 0 ? ` ${aiPending} AI request${aiPending === 1 ? '' : 's'} queued.` : ''}
          </>
        ) : syncing ? (
          <>Syncing local changes with the server…</>
        ) : failedCount > 0 ? (
          <>{failedCount} change{failedCount === 1 ? '' : 's'} could not sync. They remain saved locally.</>
        ) : (
          <>
            {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync.` : ''}
            {aiPending > 0 ? ` ${aiPending} AI request${aiPending === 1 ? '' : 's'} queued.` : ''}
          </>
        )}
      </p>
      {!offline && !syncing && (
        <button
          type="button"
          onClick={() => void syncNow()}
          className="shrink-0 underline underline-offset-2 font-medium"
        >
          Retry
        </button>
      )}
    </div>
  )
}
