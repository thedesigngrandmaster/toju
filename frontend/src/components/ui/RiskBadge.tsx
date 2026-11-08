import { cn } from '@/lib/utils'
import type { RiskScore } from '@/types'

const config: Record<RiskScore, { label: string; bg: string; text: string; dot: string }> = {
  red: { label: 'Critical', bg: 'bg-danger-bg', text: 'text-destructive', dot: 'bg-destructive' },
  yellow: { label: 'At Risk', bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning' },
  green: { label: 'Stable', bg: 'bg-success-bg', text: 'text-success', dot: 'bg-success' },
  unmonitored: {
    label: 'Pending',
    bg: 'bg-secondary',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

export function RiskBadge({ score, className }: { score: RiskScore; className?: string }) {
  const c = config[score]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap',
        c.bg,
        c.text,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', c.dot, score === 'red' && 'animate-pulse')} />
      {c.label}
    </span>
  )
}

export function RiskDot({ score }: { score: RiskScore }) {
  return <span className={cn('size-2 rounded-full', config[score].dot)} aria-hidden />
}
