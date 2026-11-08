import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudOff,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { db } from '@/lib/db'
import { useAuth } from '@/context/AuthContext'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { resolveAlertLocal } from '@/lib/repository'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn, formatDateTime, timeAgo } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { Alert, RiskScore } from '@/types'

type Filter = 'active' | 'red' | 'missed' | 'resolved' | 'all'

interface AlertRow extends Alert {
  patientName: string
  patientRisk: RiskScore | null
  patientHasSignal: boolean
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'red', label: 'Red flags' },
  { key: 'missed', label: 'Missed check-ins' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

export default function AlertsView() {
  const { doctor } = useAuth()
  const online = useIsOnline()
  const [filter, setFilter] = useState<Filter>('active')
  const [resolving, setResolving] = useState<string | null>(null)

  const rows = useLiveQuery(
    async () => {
      const [alerts, patients] = await Promise.all([db.alerts.toArray(), db.patients.toArray()])
      const patientById = new Map(patients.map((patient) => [patient.id, patient]))
      return alerts
        .map<AlertRow>((alert) => {
          const patient = patientById.get(alert.patientId)
          return {
            ...alert,
            patientName: patient?.name ?? 'Unknown patient',
            patientRisk: patient?.riskScore ?? null,
            patientHasSignal: Boolean(patient?.signal?.approvedAt),
          }
        })
        .sort(
          (a, b) =>
            Number(a.resolved) - Number(b.resolved) ||
            b.timestamp.localeCompare(a.timestamp),
        )
    },
    [],
    [] as AlertRow[],
  )

  const counts = useMemo(
    () => ({
      active: rows.filter((row) => !row.resolved).length,
      red: rows.filter((row) => !row.resolved && row.type === 'red_flag').length,
      missed: rows.filter((row) => !row.resolved && row.type === 'missed_checkin').length,
      resolved: rows.filter((row) => row.resolved).length,
      all: rows.length,
    }),
    [rows],
  )

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (filter === 'active') return !row.resolved
        if (filter === 'resolved') return row.resolved
        if (filter === 'red') return row.type === 'red_flag'
        if (filter === 'missed') return row.type === 'missed_checkin'
        return true
      }),
    [rows, filter],
  )

  async function resolve(alertId: string) {
    if (!doctor) return
    setResolving(alertId)
    try {
      await resolveAlertLocal(alertId, doctor.id)
      toast.success(
        online ? 'Alert resolved' : 'Alert resolved locally',
        online ? 'The change syncs in the background.' : 'Queued to sync when you reconnect.',
      )
    } catch (error) {
      toast.error('Could not resolve alert', error instanceof Error ? error.message : undefined)
    } finally {
      setResolving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Alerts</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {counts.active} active · {counts.red} red flag{counts.red === 1 ? '' : 's'} ·{' '}
            {counts.missed} missed check-in{counts.missed === 1 ? '' : 's'}
          </p>
        </div>
        {!online && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-[10px] font-medium text-warning">
            <CloudOff className="size-3" />
            Offline · alerts still recorded
          </span>
        )}
      </div>

      <div className="rounded-xl border border-destructive/20 bg-danger-bg/60 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-[11px] leading-relaxed text-destructive">
            RED alerts are written to this device before the network is contacted. They are never dropped and
            always sync with the highest priority.
          </p>
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filter === item.key
                ? 'border-primary bg-primary text-white'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            <span className={cn('text-[10px]', filter === item.key ? 'text-white/70' : 'text-muted-foreground/70')}>
              {counts[item.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {visible.length === 0 && (
          <div className="px-4 py-14 text-center">
            {filter === 'resolved' ? (
              <CheckCircle2 className="mx-auto mb-2 size-5 text-success" />
            ) : (
              <BellOff className="mx-auto mb-2 size-5 text-muted-foreground" />
            )}
            <p className="text-xs font-medium text-foreground">
              {filter === 'active' ? 'No active alerts — the queue is clear.' : 'Nothing in this filter.'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Alerts appear here the moment a patient message or check-in triggers a red flag.
            </p>
          </div>
        )}

        <div className="divide-y">
          {visible.map((alert) => (
            <div key={alert.id} className={cn('flex items-start gap-3 p-4', alert.resolved && 'opacity-60')}>
              <div
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                  alert.resolved
                    ? 'bg-success-bg text-success'
                    : alert.type === 'red_flag'
                      ? 'bg-danger-bg text-destructive'
                      : 'bg-warning-bg text-warning',
                )}
              >
                {alert.resolved ? (
                  <CheckCircle2 className="size-4" />
                ) : alert.type === 'red_flag' ? (
                  <AlertTriangle className="size-4" />
                ) : (
                  <Clock className="size-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      alert.resolved
                        ? 'bg-secondary text-muted-foreground'
                        : alert.type === 'red_flag'
                          ? 'bg-danger-bg text-destructive'
                          : 'bg-warning-bg text-warning',
                    )}
                  >
                    {alert.resolved
                      ? 'Resolved'
                      : alert.type === 'red_flag'
                        ? 'Red flag'
                        : 'Missed check-in'}
                  </span>
                  {alert.patientRisk && !alert.resolved && <RiskBadge score={alert.patientRisk} />}
                  {alert.syncState === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                      <CloudOff className="size-2.5" />
                      pending sync
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-foreground">{alert.message}</p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  {alert.patientHasSignal ? (
                    <Link
                      to={`/dashboard/patients/${alert.patientId}`}
                      className="inline-flex items-center gap-0.5 font-medium text-primary"
                    >
                      {alert.patientName}
                      <ChevronRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{alert.patientName}</span>
                  )}
                  <span>{formatDateTime(alert.timestamp)}</span>
                  <span>{timeAgo(alert.timestamp)}</span>
                  {alert.resolved && alert.resolvedAt && <span>Resolved {timeAgo(alert.resolvedAt)}</span>}
                </div>
              </div>

              {!alert.resolved && (
                <button
                  type="button"
                  onClick={() => void resolve(alert.id)}
                  disabled={resolving === alert.id}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {resolving === alert.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Resolving an alert is a clinician action. It is recorded in the local audit trail and synced with
        clinician-wins conflict handling.
      </p>
    </div>
  )
}
