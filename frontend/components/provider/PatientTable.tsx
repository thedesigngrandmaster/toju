'use client'

import Link from 'next/link'
import { ChevronRight, FileSignature } from 'lucide-react'
import { RiskBadge } from '@/components/ui'
import { usePatients } from '@/context/PatientsContext'
import type { Patient, RiskScore } from '@/types'

const riskOrder: Record<RiskScore, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  unmonitored: 3,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function PatientRow({ patient }: { patient: Patient }) {
  const hasSignal = !!patient.signal?.approvedAt
  const href = hasSignal
    ? `/dashboard/patients/${patient.id}`
    : `/dashboard/patients/${patient.id}/signal`

  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {patient.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {patient.age}y · {patient.diagnosis}
        </p>
      </div>

      <div className="hidden sm:block text-xs text-muted-foreground w-20 text-right">
        {formatDate(patient.dischargedDate)}
      </div>

      <div className="hidden md:block text-xs text-muted-foreground w-16 text-right">
        {timeAgo(patient.lastCheckIn)}
      </div>

      <div className="w-24 flex justify-end">
        {!hasSignal ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
            <FileSignature className="size-3" />
            Extract
          </span>
        ) : (
          <RiskBadge score={patient.riskScore} />
        )}
      </div>

      <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
    </Link>
  )
}

export default function PatientTable() {
  const { patients } = usePatients()

  const sorted = [...patients].sort(
    (a, b) => riskOrder[a.riskScore] - riskOrder[b.riskScore]
  )

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        <div className="flex-1 text-xs font-semibold text-muted-foreground">
          Patient
        </div>
        <div className="hidden sm:block text-xs font-semibold text-muted-foreground w-20 text-right">
          Discharged
        </div>
        <div className="hidden md:block text-xs font-semibold text-muted-foreground w-16 text-right">
          Last Check-in
        </div>
        <div className="w-24 text-xs font-semibold text-muted-foreground text-right">
          Status
        </div>
        <div className="w-4" />
      </div>

      <div className="divide-y">
        {sorted.map((p) => (
          <PatientRow key={p.id} patient={p} />
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No patients yet. Add your first patient to get started.
          </p>
        </div>
      )}
    </div>
  )
}
