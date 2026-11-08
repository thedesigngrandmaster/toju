import { Link } from 'react-router-dom'
import { ChevronRight, CloudOff, FileSignature, RefreshCw, WifiOff } from 'lucide-react'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import type { Patient } from '@/types'

export function PatientRow({ patient }: { patient: Patient }) {
  const hasSignal = Boolean(patient.signal?.approvedAt)
  const to = hasSignal ? `/dashboard/patients/${patient.id}` : `/dashboard/patients/${patient.id}/signal`
  const unsynced = patient.syncState !== 'synced'

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted/70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{patient.name}</p>
          {unsynced && (
            <CloudOff className="size-3 shrink-0 text-warning" aria-label="Saved locally, pending sync" />
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {patient.age > 0 ? `${patient.age}y · ` : ''}
          {patient.diagnosis}
        </p>
      </div>

      <div className="hidden w-20 text-right text-xs text-muted-foreground sm:block">
        {formatDate(patient.dischargedDate)}
      </div>
      <div className="hidden w-16 text-right text-xs text-muted-foreground md:block">
        {timeAgo(patient.lastCheckIn)}
      </div>

      <div className="flex w-[92px] justify-end">
        {patient.aiStatus === 'queued' || patient.aiStatus === 'processing' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-1 text-[10px] font-medium text-info">
            <RefreshCw className="size-2.5 animate-spin" />
            AI queued
          </span>
        ) : !hasSignal ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <FileSignature className="size-3" />
            Extract
          </span>
        ) : (
          <RiskBadge score={patient.riskScore} />
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
    </Link>
  )
}

export function PatientTable({
  patients,
  emptyMessage = 'No patients yet. Add your first patient to get started.',
  compact = false,
}: {
  patients: Patient[]
  emptyMessage?: string
  compact?: boolean
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', compact && 'rounded-lg')}>
      {!compact && (
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex-1 text-xs font-semibold text-muted-foreground">Patient</div>
          <div className="hidden w-20 text-right text-xs font-semibold text-muted-foreground sm:block">
            Discharged
          </div>
          <div className="hidden w-16 text-right text-xs font-semibold text-muted-foreground md:block">
            Last check-in
          </div>
          <div className="w-[92px] text-right text-xs font-semibold text-muted-foreground">Status</div>
          <div className="w-4" />
        </div>
      )}
      <div className="divide-y">
        {patients.map((patient) => (
          <PatientRow key={patient.id} patient={patient} />
        ))}
        {patients.length === 0 && (
          <div className="px-4 py-10 text-center">
            <WifiOff className="mx-auto mb-2 size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}
