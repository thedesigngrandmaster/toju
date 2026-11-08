import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Phone, ShieldAlert } from 'lucide-react'
import { db } from '@/lib/db'
import { timeAgo } from '@/lib/utils'

export function AlertBanner() {
  const alert = useLiveQuery(async () => {
    const alerts = await db.alerts.toArray()
    return alerts
      .filter((item) => !item.resolved && item.type === 'red_flag')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
  }, [])

  const patient = useLiveQuery(
    () => (alert ? db.patients.get(alert.patientId) : undefined),
    [alert?.patientId],
  )

  if (!alert || !patient) return null

  return (
    <div className="rounded-xl border border-destructive/20 bg-danger-bg p-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <ShieldAlert className="size-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{patient.name}</p>
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
              RED alert
            </span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(alert.timestamp)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{alert.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/dashboard/patients/${patient.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Review
            <ArrowRight className="size-3" />
          </Link>
          <a
            href={`tel:${patient.phoneNumber}`}
            className="hidden h-7 items-center gap-1 rounded-full border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Phone className="size-3" />
            Call
          </a>
        </div>
      </div>
    </div>
  )
}

export function MissedCheckInNotice() {
  const count = useLiveQuery(async () => {
    const alerts = await db.alerts.toArray()
    return alerts.filter((alert) => !alert.resolved && alert.type === 'missed_checkin').length
  }, [], 0)

  if (!count) return null

  return (
    <Link
      to="/dashboard/alerts"
      className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-[11px] font-medium text-warning"
    >
      <AlertTriangle className="size-3.5" />
      {count} missed check-in{count === 1 ? '' : 's'} need follow-up
    </Link>
  )
}
