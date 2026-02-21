'use client'

import { cn } from '@/lib/utils'
import { usePatients } from '@/context/PatientsContext'
import type { RiskScore } from '@/types'

const tiers: {
  key: RiskScore
  label: string
  dot: string
}[] = [
  { key: 'red', label: 'Critical', dot: 'bg-destructive' },
  { key: 'yellow', label: 'At Risk', dot: 'bg-warning' },
  { key: 'green', label: 'Stable', dot: 'bg-success' },
  { key: 'unmonitored', label: 'Pending', dot: 'bg-muted-foreground' },
]

export default function DashboardHeader() {
  const { patients } = usePatients()

  const counts = tiers.map((t) => ({
    ...t,
    count: patients.filter((p) => p.riskScore === t.key).length,
  }))

  const total = patients.length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Overview
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {total} patient{total !== 1 ? 's' : ''} under monitoring
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map((t) => (
          <div key={t.key} className="border rounded-xl p-4">
            <span className="text-sm font-medium text-muted-foreground">{t.label}</span>
            <p className="text-2xl font-semibold tracking-tight text-foreground mt-1">
              {t.count}
            </p>
            <div className={cn('h-0.5 w-8 rounded-full mt-2', t.dot)} />
          </div>
        ))}
      </div>
    </div>
  )
}
