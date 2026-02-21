'use client'

import { cn } from '@/lib/utils'

function getConfig(score: number) {
  if (score >= 0.9) return { label: 'High', bg: 'bg-success-bg', text: 'text-success' }
  if (score >= 0.7) return { label: 'Medium', bg: 'bg-warning-bg', text: 'text-warning' }
  return { label: 'Low', bg: 'bg-danger-bg', text: 'text-destructive' }
}

export default function ConfidenceBadge({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const c = getConfig(score)
  const pct = Math.round(score * 100)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
        c.bg,
        c.text,
        className
      )}
    >
      {pct}% {c.label}
    </span>
  )
}
