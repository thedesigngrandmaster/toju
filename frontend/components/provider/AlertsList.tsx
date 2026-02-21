'use client'

import Link from 'next/link'
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePatients } from '@/context/PatientsContext'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AlertsList() {
  const { patients, resolveAlert } = usePatients()

  const allAlerts = patients
    .flatMap((p) =>
      p.alerts.map((a) => ({
        ...a,
        patientId: p.id,
        patientName: p.name,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const unresolved = allAlerts.filter((a) => !a.resolved)
  const resolved = allAlerts.filter((a) => a.resolved)

  if (allAlerts.length === 0) {
    return (
      <div className="border rounded-xl p-10 text-center">
        <Bell className="size-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No alerts yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unresolved.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold text-muted-foreground">
              Active ({unresolved.length})
            </span>
          </div>
          <div className="divide-y">
            {unresolved.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div
                  className={cn(
                    'size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    a.type === 'red_flag' ? 'bg-danger-bg' : 'bg-warning-bg'
                  )}
                >
                  {a.type === 'red_flag' ? (
                    <AlertTriangle className="size-3.5 text-destructive" />
                  ) : (
                    <Clock className="size-3.5 text-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/patients/${a.patientId}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {a.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {a.message}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(a.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => resolveAlert(a.patientId, a.id)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CheckCircle className="size-3" />
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="text-xs font-semibold text-muted-foreground">
              Resolved ({resolved.length})
            </span>
          </div>
          <div className="divide-y">
            {resolved.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 opacity-60">
                <div className="size-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.patientName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {a.message}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {timeAgo(a.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
