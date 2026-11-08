import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  FileSignature,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { usePatients, useAiQueue } from '@/hooks/useLocalData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ConfidenceBadge } from '@/components/signal/ConfidenceBadge'
import { cn, timeAgo } from '@/lib/utils'
import type { Patient } from '@/types'

type Filter = 'pending' | 'queued' | 'approved'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Awaiting signal' },
  { key: 'queued', label: 'AI queued' },
  { key: 'approved', label: 'Approved' },
]

function matches(patient: Patient, filter: Filter): boolean {
  const approved = Boolean(patient.signal?.approvedAt)
  if (filter === 'approved') return approved
  if (filter === 'queued') return patient.aiStatus === 'queued' || patient.aiStatus === 'processing'
  return !approved
}

export default function SignalsView() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const { jobs, queued } = useAiQueue()
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)

  const pending = patients.filter((patient) => !patient.signal?.approvedAt)
  const approved = patients.filter((patient) => Boolean(patient.signal?.approvedAt))
  const aiQueued = patients.filter(
    (patient) => patient.aiStatus === 'queued' || patient.aiStatus === 'processing',
  )

  const counts: Record<Filter, number> = {
    pending: pending.length,
    queued: aiQueued.length,
    approved: approved.length,
  }

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return patients
      .filter((patient) => matches(patient, filter))
      .filter((patient) => {
        if (!term) return true
        return (
          patient.name.toLowerCase().includes(term) ||
          patient.diagnosis.toLowerCase().includes(term) ||
          patient.phoneNumber.replace(/\s/g, '').includes(term.replace(/\s/g, ''))
        )
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [patients, filter, debouncedSearch])

  const waitingJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
  const failedJobs = jobs.filter((job) => job.status === 'failed')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Care signals</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pending.length} awaiting extraction · {queued} AI job{queued === 1 ? '' : 's'} queued ·{' '}
            {approved.length} approved
          </p>
        </div>
        <Link
          to="/dashboard/patients/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-white"
        >
          <FileSignature className="size-3.5" />
          Extract signal
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className={cn(
            'rounded-xl border p-3 text-left transition-colors',
            filter === 'pending' ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
          )}
        >
          <p className="text-xl font-semibold text-foreground">{pending.length}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Awaiting signal</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('queued')}
          className={cn(
            'rounded-xl border p-3 text-left transition-colors',
            filter === 'queued' ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
          )}
        >
          <p className="text-xl font-semibold text-info">{aiQueued.length}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">AI queued</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('approved')}
          className={cn(
            'rounded-xl border p-3 text-left transition-colors',
            filter === 'approved' ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/40',
          )}
        >
          <p className="text-xl font-semibold text-success">{approved.length}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Approved</p>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patients awaiting a signal…"
            className="h-9 w-full rounded-full border bg-background pl-9 pr-9 text-xs outline-none focus:border-primary/40"
            aria-label="Search signals"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filter === item.key
                ? 'border-primary bg-primary text-white'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            <span className={cn('text-[10px]', filter === item.key ? 'text-white/70' : 'text-muted-foreground/70')}>
              {counts[item.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {visible.length === 0 && (
          <div className="px-4 py-14 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              {filter === 'pending' ? 'Every patient has an approved care signal.' : 'Nothing in this filter.'}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Signal extraction turns discharge notes into medications, red flags and monitoring questions.
            </p>
          </div>
        )}

        <div className="divide-y">
          {visible.map((patient) => {
            const approvedSignal = Boolean(patient.signal?.approvedAt)
            const draft = patient.signal && !approvedSignal
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() =>
                  navigate(
                    approvedSignal
                      ? `/dashboard/patients/${patient.id}`
                      : `/dashboard/patients/${patient.id}/signal`,
                  )
                }
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{patient.name}</p>
                    {patient.syncState !== 'synced' && (
                      <CloudOff className="size-3 shrink-0 text-warning" aria-label="Saved locally" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {patient.age > 0 ? `${patient.age}y · ` : ''}
                    {draft ? patient.signal?.diagnosis || patient.diagnosis : patient.diagnosis}
                  </p>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="text-[10px] text-muted-foreground">Updated</p>
                  <p className="text-[11px] text-foreground">{timeAgo(patient.updatedAt)}</p>
                </div>

                <div className="flex w-[104px] justify-end">
                  {patient.aiStatus === 'queued' || patient.aiStatus === 'processing' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-1 text-[10px] font-medium text-info">
                      <RefreshCw className="size-2.5 animate-spin" />
                      AI queued
                    </span>
                  ) : draft ? (
                    <span className="flex items-center gap-1">
                      <span className="rounded-full bg-warning-bg px-2 py-1 text-[10px] font-medium text-warning">
                        Review
                      </span>
                      <ConfidenceBadge score={patient.signal?.confidence ?? 0} />
                    </span>
                  ) : approvedSignal ? (
                    <RiskBadge score={patient.riskScore} />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <FileSignature className="size-3" />
                      Extract
                      <ArrowRight className="size-3" />
                    </span>
                  )}
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="flex items-center gap-2 border-b p-4">
          <Sparkles className="size-4 text-info" />
          <p className="text-sm font-medium text-muted-foreground">AI analysis queue</p>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {waitingJobs.length} waiting · {failedJobs.length} failed
          </span>
        </div>

        {jobs.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">The AI queue is empty. Gemini requests run in order.</p>
          </div>
        )}

        {jobs.length > 0 && (
          <div className="divide-y">
            {jobs.slice(0, 12).map((job) => {
              const patient = patients.find((item) => item.id === job.patientId)
              return (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      job.status === 'failed'
                        ? 'bg-danger-bg text-destructive'
                        : job.status === 'done'
                          ? 'bg-success-bg text-success'
                          : 'bg-info-bg text-info',
                    )}
                  >
                    {job.status === 'failed' ? (
                      <CloudOff className="size-3.5" />
                    ) : job.status === 'done' ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <RefreshCw className={cn('size-3.5', job.status === 'running' && 'animate-spin')} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {job.kind === 'extract-signal' ? 'Signal extraction' : 'Message triage'}
                      {patient ? ` · ${patient.name}` : ''}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {job.status} · attempt {job.attempts} · {timeAgo(job.updatedAt)}
                      {job.lastError ? ` · ${job.lastError}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {job.provenance.promptVersion}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Extraction requests are persisted in IndexedDB before they are sent. Offline requests show
        “Queued for AI analysis” and run in creation order when connectivity returns.
      </p>
    </div>
  )
}
