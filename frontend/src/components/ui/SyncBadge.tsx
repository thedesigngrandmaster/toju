import { AlertTriangle, Cloud, CloudOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useSync } from '@/context/SyncContext'
import { timeAgo } from '@/lib/utils'

export function SyncBadge({ className, showTime = false }: { className?: string; showTime?: boolean }) {
  const network = useNetworkStatus()
  const sync = useSync()

  let label = 'Synced'
  let tone = 'text-success bg-success-bg'
  let Icon = ShieldCheck

  if (network === 'simulated-offline') {
    label = 'Offline simulation'
    tone = 'text-warning bg-warning-bg'
    Icon = CloudOff
  } else if (network !== 'online') {
    label = sync.pendingCount > 0 ? `Offline · ${sync.pendingCount} saved` : 'Offline · saved'
    tone = 'text-muted-foreground bg-secondary'
    Icon = CloudOff
  } else if (sync.syncing) {
    label = 'Syncing…'
    tone = 'text-info bg-info-bg'
    Icon = Loader2
  } else if (sync.failedCount > 0) {
    label = `${sync.failedCount} sync issue${sync.failedCount === 1 ? '' : 's'}`
    tone = 'text-destructive bg-danger-bg'
    Icon = AlertTriangle
  } else if (sync.pendingCount > 0) {
    label = `${sync.pendingCount} pending`
    tone = 'text-warning bg-warning-bg'
    Icon = RefreshCw
  } else if (sync.aiPending > 0) {
    label = `${sync.aiPending} AI queued`
    tone = 'text-info bg-info-bg'
    Icon = Cloud
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
        tone,
        className,
      )}
      title={sync.lastSyncedAt ? `Last synced ${timeAgo(sync.lastSyncedAt)}` : 'Not synced yet'}
    >
      <Icon className={cn('size-3', sync.syncing && 'animate-spin')} />
      {label}
      {showTime && sync.lastSyncedAt && network === 'online' && !sync.syncing ? (
        <span className="text-muted-foreground font-normal">· {timeAgo(sync.lastSyncedAt)}</span>
      ) : null}
    </span>
  )
}
