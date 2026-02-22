'use client'

import { ArrowLeft, Phone, Calendar, Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { RiskBadge } from '@/components/ui'
import type { Patient } from '@/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PatientDetailHeader({ patient }: { patient: Patient }) {
  const router = useRouter()

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="size-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight text-foreground font-display">
              {patient.name}
            </h1>
            <RiskBadge score={patient.riskScore} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {patient.age}y · {patient.diagnosis}
          </p>
        </div>
      </div>
      <div className="p-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
            <p className="text-xs font-medium text-foreground">{patient.phoneNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Discharged</p>
            <p className="text-xs font-medium text-foreground">{formatDate(patient.dischargedDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-xs font-medium text-foreground capitalize">{patient.language}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
