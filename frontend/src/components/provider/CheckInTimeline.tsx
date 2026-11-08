import { Bot, CloudOff, MessageCircle, RefreshCw } from 'lucide-react'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { cn, formatDateTime } from '@/lib/utils'
import type { CheckIn } from '@/types'

const riskBorder: Record<string, string> = {
  red: 'border-l-destructive',
  yellow: 'border-l-warning',
  green: 'border-l-success',
}

export function CheckInTimeline({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) {
    return (
      <div className="rounded-xl border">
        <div className="border-b p-4">
          <p className="text-sm font-medium text-muted-foreground">Check-in history</p>
        </div>
        <div className="p-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No check-ins yet. Inbound WhatsApp replies appear here — even when offline.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b p-4">
        <p className="text-sm font-medium text-muted-foreground">Check-in history</p>
        <span className="ml-auto text-xs text-muted-foreground">{checkIns.length} check-ins</span>
      </div>
      <div className="divide-y">
        {checkIns.map((checkIn) => {
          const queued = checkIn.aiStatus === 'queued'
          return (
            <div
              key={checkIn.id}
              className={cn('space-y-3 border-l-2 p-4', riskBorder[checkIn.riskScore] ?? 'border-l-border')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge score={checkIn.riskScore} />
                {queued && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info">
                    <RefreshCw className="size-2.5 animate-spin" />
                    AI queued
                  </span>
                )}
                {checkIn.syncState === 'pending' && (
                  <CloudOff className="size-3 text-warning" aria-label="Pending sync" />
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {formatDateTime(checkIn.timestamp)}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[11px] text-muted-foreground">Patient</p>
                  <p className="text-xs leading-relaxed text-foreground">{checkIn.message}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[11px] text-muted-foreground">Toju</p>
                  <p className="text-xs leading-relaxed text-foreground">{checkIn.botResponse}</p>
                </div>
              </div>

              {checkIn.triggeredFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {checkIn.triggeredFlags.map((flag, index) => (
                    <span
                      key={`${flag}-${index}`}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px]',
                        checkIn.riskScore === 'red'
                          ? 'bg-danger-bg text-destructive'
                          : 'bg-warning-bg text-warning',
                      )}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}

              {checkIn.provenance && (
                <p className="text-[10px] text-muted-foreground">
                  Decision: {checkIn.provenance.source === 'gemini' ? 'Gemini' : checkIn.provenance.source} ·{' '}
                  {checkIn.provenance.promptVersion} · confidence{' '}
                  {Math.round(checkIn.provenance.confidence * 100)}%
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
