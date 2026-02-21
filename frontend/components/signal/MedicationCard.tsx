'use client'

import { cn } from '@/lib/utils'
import ConfidenceBadge from './ConfidenceBadge'
import type { Medication } from '@/types'

const statusConfig: Record<Medication['status'], { label: string; cls: string }> = {
  continued: { label: 'Continued', cls: 'bg-secondary text-muted-foreground' },
  started: { label: 'New', cls: 'bg-success-bg text-success' },
  stopped: { label: 'Stopped', cls: 'bg-danger-bg text-destructive' },
  adjusted: { label: 'Adjusted', cls: 'bg-warning-bg text-warning' },
}

export default function MedicationCard({
  medication,
  className,
}: {
  medication: Medication
  className?: string
}) {
  const s = statusConfig[medication.status]

  return (
    <div
      className={cn(
        'border rounded-xl p-4 shadow-none flex items-start gap-4 transition-colors hover:bg-muted/50',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold tracking-tight text-foreground">
            {medication.name}
          </p>
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              s.cls
            )}
          >
            {s.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {medication.dose} — {medication.frequency}
        </p>
      </div>
      <ConfidenceBadge score={medication.confidence} />
    </div>
  )
}
