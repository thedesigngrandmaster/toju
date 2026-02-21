'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { RiskScore } from '@/types'

const config: Record<
  RiskScore,
  { label: string; bg: string; text: string; dot: string }
> = {
  red: {
    label: 'Critical',
    bg: 'bg-danger-bg',
    text: 'text-destructive',
    dot: 'bg-destructive',
  },
  yellow: {
    label: 'At Risk',
    bg: 'bg-warning-bg',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  green: {
    label: 'Stable',
    bg: 'bg-success-bg',
    text: 'text-success',
    dot: 'bg-success',
  },
  unmonitored: {
    label: 'Pending',
    bg: 'bg-secondary',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

export function RiskBadge({
  score,
  className,
}: {
  score: RiskScore
  className?: string
}) {
  const c = config[score]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
        c.bg,
        c.text,
        className
      )}
    >
      {score === 'red' ? (
        <motion.span
          className={cn('size-1.5 rounded-full', c.dot)}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span className={cn('size-1.5 rounded-full', c.dot)} />
      )}
      {c.label}
    </span>
  )
}
