import { useMemo, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  ScrollText,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { useAuditLog, useConflicts } from '@/hooks/useLocalData'
import { exportAuditJson } from '@/lib/audit'
import { cn, formatDateTime } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { AuditEntry } from '@/types'

type ActorFilter = 'all' | AuditEntry['actor']

const ACTORS: { key: ActorFilter; label: string }[] = [
  { key: 'all', label: 'All activity' },
  { key: 'clinician', label: 'Clinician' },
  { key: 'ai', label: 'AI' },
  { key: 'system', label: 'System' },
]

const actorConfig: Record<
  AuditEntry['actor'],
  { label: string; icon: typeof UserRound; tone: string }
> = {
  clinician: { label: 'Clinician', icon: UserRound, tone: 'bg-primary/10 text-primary' },
  ai: { label: 'AI', icon: Bot, tone: 'bg-info-bg text-info' },
  system: { label: 'System', icon: Wrench, tone: 'bg-secondary text-muted-foreground' },
}

export default function AuditView() {
  const entries = useAuditLog(500)
  const conflicts = useConflicts()
  const [actor, setActor] = useState<ActorFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (actor !== 'all' && entry.actor !== actor) return false
      if (!term) return true
      return (
        entry.summary.toLowerCase().includes(term) ||
        entry.action.toLowerCase().includes(term) ||
        entry.entityType.toLowerCase().includes(term) ||
        (entry.promptVersion ?? '').toLowerCase().includes(term)
      )
    })
  }, [entries, actor, search])

  const counts = useMemo(
    () => ({
      all: entries.length,
      clinician: entries.filter((entry) => entry.actor === 'clinician').length,
      ai: entries.filter((entry) => entry.actor === 'ai').length,
      system: entries.filter((entry) => entry.actor === 'system').length,
    }),
    [entries],
  )

  async function handleExport() {
    setExporting(true)
    try {
      const json = await exportAuditJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `toju-audit-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Audit trail exported', `${entries.length} entries written to a local JSON file.`)
    } catch (error) {
      toast.error('Could not export audit trail', error instanceof Error ? error.message : undefined)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Audit trail</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {counts.all} local event{counts.all === 1 ? '' : 's'} · every AI decision is versioned
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || entries.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Download className="size-3.5" />
          Export JSON
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border bg-secondary/30 px-3 py-2.5">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The audit log is append-only and stored in IndexedDB. It records clinician actions, AI
          provenance (model + prompt version) and sync decisions even while offline.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search actions, entities or prompt versions…"
            className="h-9 w-full rounded-full border bg-background pl-9 pr-9 text-xs outline-none focus:border-primary/40"
            aria-label="Search audit trail"
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
        {ACTORS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActor(item.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              actor === item.key
                ? 'border-primary bg-primary text-white'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            <span className={cn('text-[10px]', actor === item.key ? 'text-white/70' : 'text-muted-foreground/70')}>
              {counts[item.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {visible.length === 0 && (
          <div className="px-4 py-14 text-center">
            <ScrollText className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">No audit entries yet.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Signing in, editing a signal, resolving an alert or running AI triage creates an entry.
            </p>
          </div>
        )}

        <div className="divide-y">
          {visible.map((entry) => {
            const config = actorConfig[entry.actor]
            const Icon = config.icon
            const isOpen = expanded === entry.id
            return (
              <div key={entry.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', config.tone)}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {config.label}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {entry.action}
                      </span>
                      {entry.promptVersion && (
                        <span className="hidden rounded-full bg-info-bg px-2 py-0.5 text-[10px] text-info sm:inline">
                          {entry.promptVersion}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">{entry.summary}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{formatDateTime(entry.timestamp)}</span>
                      <span>
                        {entry.entityType}/{entry.entityId.slice(0, 8)}
                      </span>
                      {entry.model && (
                        <span className="inline-flex items-center gap-0.5">
                          <Cpu className="size-2.5" />
                          {entry.model}
                        </span>
                      )}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t bg-secondary/20 px-4 py-3">
                    <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Entry ID</dt>
                        <dd className="break-all font-mono text-[10px] text-foreground">{entry.id}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Entity</dt>
                        <dd className="break-all font-mono text-[10px] text-foreground">{entry.entityId}</dd>
                      </div>
                      {entry.deviceId && (
                        <div>
                          <dt className="text-muted-foreground">Device</dt>
                          <dd className="break-all font-mono text-[10px] text-foreground">{entry.deviceId}</dd>
                        </div>
                      )}
                      {entry.promptVersion && (
                        <div>
                          <dt className="text-muted-foreground">Prompt version</dt>
                          <dd className="font-mono text-[10px] text-foreground">{entry.promptVersion}</dd>
                        </div>
                      )}
                    </dl>
                    {entry.detail && Object.keys(entry.detail).length > 0 && (
                      <pre className="mt-3 max-h-56 overflow-auto rounded-lg border bg-background p-3 text-[10px] leading-relaxed text-foreground">
                        {JSON.stringify(entry.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <section className="rounded-xl border">
        <div className="flex items-center gap-2 border-b p-4">
          <Wrench className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Sync conflicts</p>
          <span className="ml-auto text-[10px] text-muted-foreground">{conflicts.length} recorded</span>
        </div>
        {conflicts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              No conflicts. When the server and this device disagree, the clinician&apos;s local edit wins
              and the decision is recorded here.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {conflicts.slice(0, 20).map((conflict) => (
              <div key={conflict.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
                    {conflict.resolution}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {conflict.entityType}/{conflict.entityId.slice(0, 8)}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatDateTime(conflict.detectedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Server version {conflict.serverVersion}
                  {conflict.localOperationId ? ` · local operation ${conflict.localOperationId.slice(0, 8)}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
