'use client'

import { useState } from 'react'
import { FileText, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfidenceBadge from './ConfidenceBadge'
import MedicationCard from './MedicationCard'
import RedFlagList from './RedFlagList'
import MonitoringSchedule from './MonitoringSchedule'
import type { ClinicalSignal } from '@/types'

type Props = {
  signal: ClinicalSignal
  onSignalChange: (signal: ClinicalSignal) => void
}

export default function SplitReview({ signal, onSignalChange }: Props) {
  const [activeTab, setActiveTab] = useState<'signal' | 'raw'>('signal')

  function handleSummaryChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onSignalChange({ ...signal, patientSummary: e.target.value })
  }

  function handleRedFlagsChange(flags: string[]) {
    onSignalChange({ ...signal, redFlags: flags })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="border rounded-xl shadow-none overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Raw Notes</p>
          <span className="text-xs text-muted-foreground ml-auto">
            {signal.rawNotes.length.toLocaleString()} chars
          </span>
        </div>
        <div className="p-4 flex-1 overflow-y-auto max-h-[70vh]">
          <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
            {signal.rawNotes}
          </pre>
        </div>
      </div>

      <div className="border rounded-xl shadow-none overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Stethoscope className="size-5 text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Extracted Signal
          </p>
          <ConfidenceBadge score={signal.confidence} className="ml-auto" />
        </div>

        <div className="lg:hidden p-4 pb-0 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('signal')}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
              activeTab === 'signal'
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Signal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
              activeTab === 'raw'
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Raw
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto max-h-[70vh] space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Diagnosis
            </p>
            <p className="text-xs text-foreground">
              {signal.diagnosis}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Patient Summary
            </p>
            <textarea
              value={signal.patientSummary}
              onChange={handleSummaryChange}
              rows={4}
              className="w-full border rounded-xl p-4 text-xs text-foreground bg-background resize-none outline-none transition-all leading-relaxed"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Medications ({signal.medications.length})
            </p>
            <div className="space-y-2">
              {signal.medications.map((med) => (
                <MedicationCard key={med.id} medication={med} />
              ))}
            </div>
          </div>

          <RedFlagList
            flags={signal.redFlags}
            onChange={handleRedFlagsChange}
          />

          <MonitoringSchedule items={signal.monitoringSchedule} />
        </div>
      </div>
    </div>
  )
}
