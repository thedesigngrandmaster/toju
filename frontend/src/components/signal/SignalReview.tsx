import { useState } from 'react'
import { AlertTriangle, CalendarCheck, FileText, Plus, ShieldCheck, Stethoscope, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfidenceBadge } from './ConfidenceBadge'
import { cn } from '@/lib/utils'
import type { ClinicalSignal, Medication } from '@/types'

const statusCls: Record<Medication['status'], string> = {
  continued: 'bg-secondary text-muted-foreground',
  started: 'bg-success-bg text-success',
  stopped: 'bg-danger-bg text-destructive',
  adjusted: 'bg-warning-bg text-warning',
}

export function SignalReview({
  signal,
  onChange,
  onApprove,
  approving,
  offline,
}: {
  signal: ClinicalSignal
  onChange: (signal: ClinicalSignal) => void
  onApprove: () => void
  approving: boolean
  offline: boolean
}) {
  const [tab, setTab] = useState<'signal' | 'raw'>('signal')
  const [confirm, setConfirm] = useState(false)
  const [flagDraft, setFlagDraft] = useState('')

  function addFlag() {
    const value = flagDraft.trim()
    if (!value || signal.redFlags.includes(value)) return
    onChange({ ...signal, redFlags: [...signal.redFlags, value] })
    setFlagDraft('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('signal')}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            tab === 'signal' ? 'border-primary bg-primary text-white' : 'text-muted-foreground',
          )}
        >
          Extracted signal
        </button>
        <button
          type="button"
          onClick={() => setTab('raw')}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            tab === 'raw' ? 'border-primary bg-primary text-white' : 'text-muted-foreground',
          )}
        >
          Raw notes
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <ConfidenceBadge score={signal.confidence} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={cn('flex flex-col overflow-hidden rounded-xl border', tab !== 'raw' && 'hidden lg:flex')}>
          <div className="flex items-center gap-2 border-b p-4">
            <FileText className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Raw notes</p>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {signal.rawNotes.length.toLocaleString()} chars
            </span>
          </div>
          <div className="max-h-[70vh] flex-1 overflow-y-auto p-4">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/80">
              {signal.rawNotes}
            </pre>
          </div>
        </div>

        <div className={cn('overflow-hidden rounded-xl border', tab !== 'signal' && 'hidden lg:block')}>
          <div className="flex items-center gap-2 border-b p-4">
            <Stethoscope className="size-4 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Clinical signal</p>
            {signal.provenance && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {signal.provenance.model} · {signal.provenance.promptVersion}
              </span>
            )}
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Diagnosis</p>
              <input
                value={signal.diagnosis}
                onChange={(event) => onChange({ ...signal, diagnosis: event.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary/40"
              />
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Patient summary</p>
              <textarea
                value={signal.patientSummary}
                onChange={(event) => onChange({ ...signal, patientSummary: event.target.value })}
                rows={4}
                className="w-full resize-none rounded-xl border bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary/40"
              />
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">Medications ({signal.medications.length})</p>
              <div className="space-y-2">
                {signal.medications.map((medication) => (
                  <div key={medication.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground">{medication.name}</p>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusCls[medication.status])}>
                          {medication.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {medication.dose} — {medication.frequency}
                      </p>
                    </div>
                    <ConfidenceBadge score={medication.confidence} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Red flags ({signal.redFlags.length})</p>
              </div>
              <div className="space-y-1.5">
                {signal.redFlags.map((flag, index) => (
                  <div
                    key={`${flag}-${index}`}
                    className="flex items-start gap-2 rounded-lg border border-destructive/10 bg-danger-bg/40 px-3 py-2"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                    <p className="flex-1 text-xs leading-relaxed text-foreground">{flag}</p>
                    <button
                      type="button"
                      onClick={() => onChange({ ...signal, redFlags: signal.redFlags.filter((_, i) => i !== index) })}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove red flag"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={flagDraft}
                  onChange={(event) => setFlagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addFlag()
                    }
                  }}
                  placeholder="Add a red flag symptom…"
                  className="flex-1 rounded-full border bg-background px-3 py-1.5 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={addFlag}
                  disabled={!flagDraft.trim()}
                  className="text-primary disabled:text-muted-foreground"
                  aria-label="Add red flag"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <CalendarCheck className="size-4 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Monitoring schedule ({signal.monitoringSchedule.length})
                </p>
              </div>
              <div className="space-y-1.5">
                {signal.monitoringSchedule.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <p className="flex-1 text-xs leading-relaxed text-foreground">{item.question}</p>
                    <span className="shrink-0 text-[10px] capitalize text-muted-foreground">
                      {item.frequency}
                      {item.time && ` · ${item.time}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 rounded-xl border p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Verify & sync this care plan</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Approval creates the source of truth. A WhatsApp welcome message is queued
            {offline ? ' locally and will send when you reconnect.' : ' and sent when the WhatsApp session is ready.'}
          </p>
        </div>
        <Button
          onClick={() => setConfirm(true)}
          startIcon={<ShieldCheck className="size-4" />}
          className="shrink-0 px-6"
        >
          Verify & sync
        </Button>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Verify & sync this signal?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirm(false)
                onApprove()
              }}
              loading={approving}
              startIcon={<ShieldCheck className="size-4" />}
            >
              Confirm & sync
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            This creates the source of truth. The care plan will be sent to the patient via WhatsApp and
            proactive monitoring will begin.
          </p>
          <div className="rounded-lg bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {offline
              ? 'You are offline. The approval, audit entry and WhatsApp message are queued durably on this device.'
              : 'If the WhatsApp session is down, the welcome message is persisted in the server outbound queue and retried.'}
          </div>
        </div>
      </Modal>
    </div>
  )
}
