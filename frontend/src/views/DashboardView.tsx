import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CloudOff,
  Cpu,
  FileSignature,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { usePatients, usePatientStats, useAuditLog } from '@/hooks/useLocalData'
import { useSync } from '@/context/SyncContext'
import { AlertBanner, MissedCheckInNotice } from '@/components/provider/AlertBanner'
import { PatientTable } from '@/components/provider/PatientTable'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { SyncBadge } from '@/components/ui/SyncBadge'
import { timeAgo } from '@/lib/utils'
import type { RiskScore } from '@/types'

const statConfig: { key: RiskScore; label: string; className: string; href: string }[] = [
  { key: 'red', label: 'Critical', className: 'text-destructive', href: '/dashboard/patients?risk=red' },
  { key: 'yellow', label: 'At risk', className: 'text-warning', href: '/dashboard/patients?risk=yellow' },
  { key: 'green', label: 'Stable', className: 'text-success', href: '/dashboard/patients?risk=green' },
  {
    key: 'unmonitored',
    label: 'Pending signal',
    className: 'text-muted-foreground',
    href: '/dashboard/patients?risk=unmonitored',
  },
]

export default function DashboardView() {
  const { patients } = usePatients()
  const stats = usePatientStats(patients)
  const audit = useAuditLog(6)
  const { pendingCount, aiPending, syncing, failedCount, syncNow } = useSync()

  const priority = patients
    .filter((patient) => patient.riskScore === 'red' || patient.riskScore === 'yellow')
    .slice(0, 6)
  const pendingSignals = patients.filter((patient) => !patient.signal?.approvedAt)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {patients.length} patient{patients.length === 1 ? '' : 's'} under monitoring ·{' '}
            <span className="text-foreground">{stats.red} critical</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge showTime />
          <Link
            to="/dashboard/patients/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-white"
          >
            <Plus className="size-3.5" />
            Add patient
          </Link>
        </div>
      </div>

      <AlertBanner />
      <InstallPrompt />
      <MissedCheckInNotice />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statConfig.map((stat) => (
          <Link key={stat.key} to={stat.href} className="rounded-xl border p-4 transition-colors hover:bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <p className={`mt-1 text-2xl font-semibold tracking-tight ${stat.className}`}>{stats[stat.key]}</p>
            <div className="mt-2 h-0.5 w-8 rounded-full bg-current opacity-60" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="space-y-2 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground">Priority queue</h2>
            <Link
              to="/dashboard/patients"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <PatientTable
            patients={priority}
            emptyMessage="No critical or at-risk patients right now — the queue is clear."
          />
          {pendingSignals.length > 0 && (
            <Link
              to="/dashboard/signals"
              className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-[11px] font-medium text-warning"
            >
              <FileSignature className="size-3.5" />
              {pendingSignals.length} patient{pendingSignals.length === 1 ? '' : 's'} awaiting signal extraction
              <ArrowRight className="ml-auto size-3" />
            </Link>
          )}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground">Offline sync</h2>
              <button
                type="button"
                onClick={() => void syncNow()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary"
              >
                <RefreshCw className={`size-3 ${syncing ? 'animate-spin' : ''}`} />
                Sync now
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className="text-base font-semibold text-foreground">{pendingCount}</p>
                <p className="text-[10px] text-muted-foreground">To sync</p>
              </div>
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className="text-base font-semibold text-foreground">{aiPending}</p>
                <p className="text-[10px] text-muted-foreground">AI queued</p>
              </div>
              <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                <p className={`text-base font-semibold ${failedCount ? 'text-destructive' : 'text-foreground'}`}>
                  {failedCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Issues</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                All clinical reads and writes go to IndexedDB first. The UI never waits for the network.
              </p>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="text-xs font-semibold text-muted-foreground">Recent activity</h2>
            <div className="mt-3 space-y-3">
              {audit.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No local activity recorded yet.</p>
              )}
              {audit.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug text-foreground">{entry.summary}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {entry.actor} · {timeAgo(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/dashboard/alerts"
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
            >
              <Bell className="size-3.5 text-destructive" />
              Alerts
            </Link>
            <Link
              to="/dashboard/whatsapp"
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
            >
              <Users className="size-3.5 text-primary" />
              WhatsApp
            </Link>
            <Link
              to="/dashboard/audit"
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
            >
              <Cpu className="size-3.5 text-info" />
              AI audit
            </Link>
            <Link
              to="/dashboard/patients/new"
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
            >
              <CloudOff className="size-3.5 text-warning" />
              Offline test
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
