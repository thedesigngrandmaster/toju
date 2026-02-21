'use client'

import { Clock, CalendarCheck } from 'lucide-react'
import type { MonitoringItem } from '@/types'

const freqLabel: Record<MonitoringItem['frequency'], string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
}

export default function MonitoringSchedule({
  items,
}: {
  items: MonitoringItem[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-4 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          Monitoring Schedule
        </p>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-4 border rounded-lg px-4 py-3 shadow-none"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">
                {item.question}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                {freqLabel[item.frequency]}
                {item.time && ` · ${item.time}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
