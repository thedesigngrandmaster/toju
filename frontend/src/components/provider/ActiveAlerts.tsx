import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, CloudOff, Loader2 } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { resolveAlertLocal } from '@/lib/repository'
import { useAuth } from '@/context/AuthContext'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { toast } from '@/lib/toast'
import type { Alert } from '@/types'

const typeConfig: Record<Alert['type'], { label: string; cls: string }> = {
  red_flag: { label: 'Red flag', cls: 'bg-danger-bg text-destructive' },
  missed_checkin: { label: 'Missed check-in', cls: 'bg-warning-bg text-warning' },
}

export function ActiveAlerts({ alerts }: { alerts: Alert[] }) {
  const { doctor } = useAuth()
  const online = useIsOnline()
  const [resolving, setResolving] = useState<string | null>(null)

  const active = alerts.filter((alert) => !alert.resolved)
  const resolved = alerts.filter((alert) => alert.resolved)

  async function resolve(alertId: string) {
    if (!doctor) return
    setResolving(alertId)
    try {
      await resolveAlertLocal(alertId, doctor.id)
      toast.success(
        online ? 'Alert resolved' : 'Alert resolved locally',
        online ? 'The change will sync in the background.' : 'Queued to sync when you reconnect.',
      )
    } catch (error) {
      toast.error('Could not resolve alert', error instanceof Error ? error.message : undefined)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b p-4">
        <AlertTriangle className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Alerts</p>
        {active.length > 0 && (
          <span className="ml-auto rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-medium text-destructive">
            {active.length} active
          </span>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="p-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">No alerts for this patient.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="divide-y">
          {active.map((alert) => {
            const config = typeConfig[alert.type]
            return (
              <div key={alert.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', config.cls)}>
                      {config.label}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDateTime(alert.timestamp)}
                    </span>
                    {alert.syncState === 'pending' && <CloudOff className="size-3 text-warning" />}
                  </div>
                  <p className="text-xs leading-relaxed text-foreground">{alert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void resolve(alert.id)}
                  disabled={resolving === alert.id}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {resolving === alert.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  Resolve
                </button>
              </div>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <div className="border-t bg-secondary/30 px-4 py-2">
            <p className="text-[11px] text-muted-foreground">Resolved ({resolved.length})</p>
          </div>
          <div className="divide-y">
            {resolved.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-4 opacity-60">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground">{alert.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Resolved {formatDateTime(alert.resolvedAt)}
                    {alert.syncState === 'pending' && ' · pending sync'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
