import { cn } from '@/lib/utils'

export function ConfidenceBadge({ score, className }: { score: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100)
  const tone =
    score >= 0.9
      ? 'bg-success-bg text-success'
      : score >= 0.7
        ? 'bg-warning-bg text-warning'
        : 'bg-danger-bg text-destructive'
  const label = score >= 0.9 ? 'High' : score >= 0.7 ? 'Medium' : 'Low'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tone, className)}>
      {pct}% {label}
    </span>
  )
}
