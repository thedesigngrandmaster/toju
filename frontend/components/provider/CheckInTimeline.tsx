'use client'

import { MessageCircle, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RiskBadge } from '@/components/ui'
import type { CheckIn } from '@/types'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const riskBorder: Record<string, string> = {
  red: 'border-l-destructive',
  yellow: 'border-l-warning',
  green: 'border-l-success',
}

export default function CheckInTimeline({ checkIns }: { checkIns: CheckIn[] }) {
  if (checkIns.length === 0) {
    return (
      <div className="border rounded-xl shadow-none">
        <div className="p-4 border-b">
          <p className="text-sm font-medium text-muted-foreground">Check-in History</p>
        </div>
        <div className="p-4 text-center py-10">
          <p className="text-xs text-muted-foreground">No check-ins yet. Waiting for patient to respond.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-xl shadow-none">
      <div className="p-4 border-b flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">Check-in History</p>
        <span className="text-xs text-muted-foreground ml-auto">{checkIns.length} check-ins</span>
      </div>
      <div className="divide-y">
        {checkIns.map((ci) => (
          <div
            key={ci.id}
            className={cn(
              'p-4 border-l-2 space-y-3',
              riskBorder[ci.riskScore] ?? 'border-l-border'
            )}
          >
            <div className="flex items-center gap-2">
              <RiskBadge score={ci.riskScore} />
              <span className="text-xs text-muted-foreground ml-auto">{formatTime(ci.timestamp)}</span>
            </div>

            <div className="flex items-start gap-3">
              <MessageCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Patient</p>
                <p className="text-xs text-foreground leading-relaxed">{ci.message}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Bot className="size-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Toju</p>
                <p className="text-xs text-foreground leading-relaxed">{ci.botResponse}</p>
              </div>
            </div>

            {ci.triggeredFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ci.triggeredFlags.map((flag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-danger-bg text-destructive px-2 py-0.5 rounded-full"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
