import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarCheck,
  FileSignature,
  Pill,
  RefreshCw,
  Stethoscope,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { ConfidenceBadge } from '@/components/signal/ConfidenceBadge'
import type { ClinicalSignal, Medication } from '@/types'

const statusCls: Record<Medication['status'], string> = {
  continued: 'bg-secondary text-muted-foreground',
  started: 'bg-success-bg text-success',
  stopped: 'bg-danger-bg text-destructive',
  adjusted: 'bg-warning-bg text-warning',
}

export function SignalSummary({
  signal,
  patientId,
  aiStatus,
}: {
  signal: ClinicalSignal | null
  patientId: string
  aiStatus?: string
}) {
  if (!signal) {
    return (
      <div className="rounded-xl border">
        <div className="border-b p-4">
          <p className="text-sm font-medium text-muted-foreground">Clinical signal</p>
        </div>
        <div className="space-y-3 p-4 py-10 text-center">
          {aiStatus === 'queued' || aiStatus === 'processing' ? (
            <>
              <RefreshCw className="mx-auto size-5 animate-spin text-info" />
              <p className="text-xs font-medium text-info">Queued for AI analysis</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The raw notes are saved on this device. Gemini will extract the signal automatically when
                connectivity returns.
              </p>
            </>
          ) : (
            <>
              <FileSignature className="mx-auto size-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No signal extracted yet.</p>
              <Link
                to={`/dashboard/patients/${patientId}/signal`}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Extract signal
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b p-4">
        <Stethoscope className="size-5 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Clinical signal</p>
        <ConfidenceBadge score={signal.confidence} className="ml-auto" />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            {signal.approvedAt ? `Approved ${formatDate(signal.approvedAt)}` : 'Draft — not approved'}
          </span>
          {signal.provenance && (
            <span className="text-[10px] text-muted-foreground">
              {signal.provenance.source === 'gemini' ? 'Gemini' : signal.provenance.source} ·{' '}
              {signal.provenance.promptVersion}
            </span>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Diagnosis</p>
          <p className="text-xs font-medium text-foreground">{signal.diagnosis}</p>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Patient summary</p>
          <p className="text-xs leading-relaxed text-foreground">{signal.patientSummary}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Pill className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Medications ({signal.medications?.length ?? 0})</p>
          </div>
          <div className="space-y-1.5">
            {(signal.medications ?? []).map((medication, index) => (
              <div key={medication.id || index} className="flex flex-wrap items-center gap-2 py-1">
                <p className="flex-1 text-xs font-medium text-foreground">{medication.name}</p>
                <span className="text-[11px] text-muted-foreground">
                  {medication.dose} · {medication.frequency}
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px]', statusCls[medication.status])}>
                  {medication.status}
                </span>
                <ConfidenceBadge score={medication.confidence} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <p className="text-xs text-muted-foreground">Red flags ({signal.redFlags?.length ?? 0})</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(signal.redFlags ?? []).map((flag, index) => (
              <span
                key={`${flag}-${index}`}
                className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] text-destructive"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <CalendarCheck className="size-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              Monitoring ({signal.monitoringSchedule?.length ?? 0})
            </p>
          </div>
          <div className="space-y-1.5">
            {(signal.monitoringSchedule ?? []).map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <p className="flex-1 text-xs leading-relaxed text-foreground">{item.question}</p>
                <span className="shrink-0 text-[10px] capitalize text-muted-foreground">
                  {item.frequency}
                  {item.time && ` · ${item.time}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t pt-3">
          <Link
            to={`/dashboard/patients/${patientId}/signal`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Re-extract signal
          </Link>
        </div>
      </div>
    </div>
  )
}
