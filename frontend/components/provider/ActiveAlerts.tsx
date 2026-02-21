'use client'

import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import { usePatients } from '@/context/PatientsContext'
import type { Alert } from '@/types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const typeConfig: Record<Alert['type'], { label: string; cls: string }> = {
  red_flag: { label: 'Red Flag', cls: 'bg-danger-bg text-destructive' },
  missed_checkin: { label: 'Missed Check-in', cls: 'bg-warning-bg text-warning' },
}

export default function ActiveAlerts({
  alerts,
  patientId,
}: {
  alerts: Alert[]
  patientId: string
}) {
  const { resolveAlert } = usePatients()

  const active = alerts.filter((a) => !a.resolved)
  const resolved = alerts.filter((a) => a.resolved)

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b flex items-center gap-2">
        <AlertTriangle className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Alerts</p>
        {active.length > 0 && (
          <span className="text-xs bg-danger-bg text-destructive px-2 py-0.5 rounded-full ml-auto">
            {active.length} active
          </span>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="p-4 text-center py-10">
          <p className="text-xs text-muted-foreground">No alerts for this patient.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="divide-y">
          {active.map((alert) => {
            const t = typeConfig[alert.type]
            return (
              <div key={alert.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', t.cls)}>
                      {t.label}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{alert.message}</p>
                </div>
                <Button
                  variant="bordered"
                  size="sm"
                  className="px-4 shrink-0"
                  onPress={() => resolveAlert(patientId, alert.id)}
                >
                  Resolve
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <div className="px-4 py-2 border-t bg-secondary/30">
            <p className="text-xs text-muted-foreground">Resolved ({resolved.length})</p>
          </div>
          <div className="divide-y">
            {resolved.map((alert) => (
              <div key={alert.id} className="p-4 flex items-start gap-4 opacity-60">
                <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(alert.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
