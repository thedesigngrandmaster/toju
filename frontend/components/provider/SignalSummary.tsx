'use client'

import Link from 'next/link'
import { Stethoscope, Pill, AlertTriangle, CalendarCheck, FileSignature } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfidenceBadge } from '@/components/signal'
import type { ClinicalSignal, Medication } from '@/types'

const statusCls: Record<Medication['status'], string> = {
  continued: 'bg-secondary text-muted-foreground',
  started: 'bg-success-bg text-success',
  stopped: 'bg-danger-bg text-destructive',
  adjusted: 'bg-warning-bg text-warning',
}

export default function SignalSummary({
  signal,
  patientId,
}: {
  signal: ClinicalSignal | null
  patientId: string
}) {
  if (!signal) {
    return (
      <div className="border rounded-xl shadow-none">
        <div className="p-4 border-b">
          <p className="text-sm font-medium text-muted-foreground">Clinical Signal</p>
        </div>
        <div className="p-4 text-center py-10 space-y-3">
          <FileSignature className="size-5 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">No signal extracted yet.</p>
          <Link
            href={`/dashboard/patients/${patientId}/signal`}
            className="text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Extract Signal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b flex items-center gap-2">
        <Stethoscope className="size-5 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Clinical Signal</p>
        <ConfidenceBadge score={signal.confidence} className="ml-auto" />
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Diagnosis</p>
          <p className="text-xs font-medium text-foreground">{signal.diagnosis}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Patient Summary</p>
          <p className="text-xs text-foreground leading-relaxed">{signal.patientSummary}</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Medications ({signal.medications.length})</p>
          </div>
          <div className="space-y-1.5">
            {signal.medications.map((med) => (
              <div key={med.id} className="flex items-center gap-2 py-1">
                <p className="text-xs font-medium text-foreground flex-1">{med.name}</p>
                <span className="text-xs text-muted-foreground">{med.dose} · {med.frequency}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', statusCls[med.status])}>
                  {med.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-4 text-destructive" />
            <p className="text-xs text-muted-foreground">Red Flags ({signal.redFlags.length})</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {signal.redFlags.map((flag, i) => (
              <span
                key={i}
                className="text-xs bg-danger-bg text-destructive px-2 py-0.5 rounded-full"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck className="size-4 text-primary" />
            <p className="text-xs text-muted-foreground">Monitoring ({signal.monitoringSchedule.length})</p>
          </div>
          <div className="space-y-1.5">
            {signal.monitoringSchedule.map((item) => (
              <div key={item.id} className="flex items-center gap-4 border rounded-lg px-4 py-3 shadow-none">
                <p className="text-xs text-foreground flex-1">{item.question}</p>
                <span className="text-xs text-muted-foreground shrink-0 capitalize">
                  {item.frequency}{item.time && ` · ${item.time}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Link
            href={`/dashboard/patients/${patientId}/signal`}
            className="text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Re-extract Signal
          </Link>
        </div>
      </div>
    </div>
  )
}
