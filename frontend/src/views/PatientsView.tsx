import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { usePatients, usePatientStats } from '@/hooks/useLocalData'
import { PatientTable } from '@/components/provider/PatientTable'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import type { PatientLanguage, RiskScore } from '@/types'

const filters: { key: RiskScore | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'red', label: 'Critical' },
  { key: 'yellow', label: 'At risk' },
  { key: 'green', label: 'Stable' },
  { key: 'unmonitored', label: 'Pending' },
]

const languages: { key: PatientLanguage | 'all'; label: string }[] = [
  { key: 'all', label: 'Any language' },
  { key: 'english', label: 'English' },
  { key: 'pidgin', label: 'Pidgin' },
  { key: 'yoruba', label: 'Yoruba' },
  { key: 'igbo', label: 'Igbo' },
  { key: 'hausa', label: 'Hausa' },
]

export default function PatientsView() {
  const { patients } = usePatients()
  const stats = usePatientStats(patients)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState<PatientLanguage | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 200)
  const risk = (params.get('risk') as RiskScore | 'all') || 'all'

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return patients.filter((patient) => {
      if (risk !== 'all' && patient.riskScore !== risk) return false
      if (language !== 'all' && patient.language !== language) return false
      if (!term) return true
      return (
        patient.name.toLowerCase().includes(term) ||
        patient.diagnosis.toLowerCase().includes(term) ||
        patient.phoneNumber.replace(/\s/g, '').includes(term.replace(/\s/g, ''))
      )
    })
  }, [patients, risk, language, debouncedSearch])

  function setRisk(next: RiskScore | 'all') {
    const updated = new URLSearchParams(params)
    if (next === 'all') updated.delete('risk')
    else updated.set('risk', next)
    setParams(updated, { replace: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Patients</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.total} under monitoring · {stats.red} critical · {stats.yellow} at risk
          </p>
        </div>
        <Link
          to="/dashboard/patients/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-white"
        >
          <Plus className="size-3.5" />
          Add patient
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, diagnosis or phone…"
            className="h-9 w-full rounded-full border bg-background pl-9 pr-9 text-xs outline-none focus:border-primary/40"
            aria-label="Search patients"
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
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
            showFilters || language !== 'all' ? 'border-primary/40 bg-primary/5 text-primary' : 'text-muted-foreground',
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
        </button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {filters.map((filter) => {
          const count =
            filter.key === 'all' ? stats.total : stats[filter.key as keyof typeof stats]
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setRisk(filter.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                risk === filter.key
                  ? 'border-primary bg-primary text-white'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {filter.label}
              <span className={cn('text-[10px]', risk === filter.key ? 'text-white/70' : 'text-muted-foreground/70')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-[11px] font-medium text-muted-foreground">Language</span>
          {languages.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setLanguage(item.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                language === item.key
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <PatientTable
        patients={filtered}
        emptyMessage={
          patients.length === 0
            ? 'No patients cached yet. Add a patient or connect to sync.'
            : 'No patients match your filters.'
        }
      />

      <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
        Sorted by clinical risk. Data is read directly from this device; changes appear instantly and sync in
        the background.
      </p>
    </div>
  )
}
