import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CloudOff,
  Globe,
  Loader2,
  MessageSquarePlus,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Stethoscope,
  TestTube2,
} from 'lucide-react'
import { usePatient } from '@/hooks/useLocalData'
import { useAuth } from '@/context/AuthContext'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { ActiveAlerts } from '@/components/provider/ActiveAlerts'
import { CheckInTimeline } from '@/components/provider/CheckInTimeline'
import { SignalSummary } from '@/components/provider/SignalSummary'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { addNoteLocal, updatePatientRisk } from '@/lib/repository'
import { triagePatientMessage } from '@/lib/ai'
import { refreshPatientFromServer } from '@/lib/sync-core'
import { formatDate, formatDateTime, timeAgo, titleCase } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { RiskScore, TriageResponse } from '@/types'

const RISK_OPTIONS: RiskScore[] = ['red', 'yellow', 'green', 'unmonitored']

export default function PatientDetailView() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { doctor } = useAuth()
  const online = useIsOnline()
  const { bundle, loading } = usePatient(patientId)

  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [message, setMessage] = useState('')
  const [triaging, setTriaging] = useState(false)
  const [triageResult, setTriageResult] = useState<{
    result: TriageResponse
    alertCreated: boolean
    queued: boolean
  } | null>(null)
  const [showTriage, setShowTriage] = useState(false)

  useEffect(() => {
    if (online && patientId) void refreshPatientFromServer(patientId)
  }, [online, patientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-5 text-primary" />
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="rounded-xl border p-10 text-center">
        <p className="text-sm font-medium text-foreground">Patient not available offline</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          This record has not been cached on this device. Connect to the internet once to download it.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/patients')}>
          Back to patients
        </Button>
      </div>
    )
  }

  const { patient, checkIns, alerts, notes } = bundle
  const activeAlerts = alerts.filter((alert) => !alert.resolved)
  const canTriage = patient.signal?.approvedAt

  async function saveNote() {
    if (!doctor || !note.trim()) return
    setSavingNote(true)
    try {
      await addNoteLocal(patient.id, note, { id: doctor.id, name: doctor.name })
      setNote('')
      toast.success('Note saved locally', online ? 'Syncing in the background.' : 'Will sync when you reconnect.')
    } catch (error) {
      toast.error('Could not save note', error instanceof Error ? error.message : undefined)
    } finally {
      setSavingNote(false)
    }
  }

  async function runTriage() {
    if (!message.trim() || !canTriage) return
    setTriaging(true)
    setTriageResult(null)
    try {
      const outcome = await triagePatientMessage(patient, message.trim())
      setTriageResult({
        result: {
          riskScore: outcome.checkIn.riskScore as TriageResponse['riskScore'],
          triggeredFlags: outcome.checkIn.triggeredFlags,
          botResponse: outcome.checkIn.botResponse,
          provenance: outcome.checkIn.provenance!,
        },
        alertCreated: Boolean(outcome.alert) || activeAlerts.some((alert) => alert.type === 'red_flag'),
        queued: outcome.queued,
      })
      setMessage('')
      if (outcome.checkIn.riskScore === 'red') {
        toast.error(
          'RED alert recorded',
          outcome.queued
            ? 'Saved locally and queued aggressively for sync. AI analysis will refine it when online.'
            : 'The alert is now on the dashboard and synced.',
        )
      } else if (outcome.queued) {
        toast.info('Added to AI queue', 'The message was triaged locally; Gemini will refine it when online.')
      } else {
        toast.success(`Triaged as ${outcome.checkIn.riskScore}`)
      }
    } catch (error) {
      toast.error('Triage failed', error instanceof Error ? error.message : undefined)
    } finally {
      setTriaging(false)
    }
  }

  async function changeRisk(next: RiskScore) {
    if (!doctor) return
    await updatePatientRisk(patient.id, next, doctor.id)
    toast.success(`Risk set to ${next}`, 'Saved locally; synced in the background.')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border">
        <div className="flex items-center gap-3 border-b p-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/patients')}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to patients"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-base font-semibold tracking-tight text-foreground">{patient.name}</h1>
              <RiskBadge score={patient.riskScore} />
              {patient.syncState !== 'synced' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
                  <CloudOff className="size-2.5" />
                  Saved locally
                </span>
              )}
              {patient.aiStatus === 'queued' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info">
                  <RefreshCw className="size-2.5 animate-spin" />
                  AI queued
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {patient.age > 0 ? `${patient.age}y · ` : ''}
              {patient.diagnosis}
            </p>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <label htmlFor="risk-override" className="text-[10px] text-muted-foreground">
              Risk
            </label>
            <select
              id="risk-override"
              value={patient.riskScore}
              onChange={(event) => void changeRisk(event.target.value as RiskScore)}
              className="h-7 rounded-full border bg-background px-2 text-[11px] font-medium capitalize outline-none"
            >
              {RISK_OPTIONS.map((risk) => (
                <option key={risk} value={risk}>
                  {titleCase(risk)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 p-4">
          <a href={`tel:${patient.phoneNumber}`} className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">WhatsApp</p>
              <p className="text-xs font-medium text-foreground">{patient.phoneNumber}</p>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Discharged</p>
              <p className="text-xs font-medium text-foreground">{formatDate(patient.dischargedDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Language</p>
              <p className="text-xs font-medium capitalize text-foreground">{patient.language}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Last check-in</p>
              <p className="text-xs font-medium text-foreground">{timeAgo(patient.lastCheckIn)}</p>
            </div>
          </div>
        </div>
        {!canTriage && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-warning-bg/50 px-4 py-2.5 text-[11px] text-warning">
            <Stethoscope className="size-3.5" />
            This patient has no approved care signal yet.
            <Link to={`/dashboard/patients/${patient.id}/signal`} className="font-medium underline underline-offset-2">
              Extract signal
            </Link>
          </div>
        )}
      </div>

      {activeAlerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-danger-bg px-3 py-2 text-[11px] font-medium text-destructive">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          {activeAlerts.length} active alert{activeAlerts.length === 1 ? '' : 's'} — review before leaving this
          screen.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ActiveAlerts alerts={alerts} />
          <CheckInTimeline checkIns={checkIns} />
        </div>
        <div className="space-y-4">
          <SignalSummary signal={patient.signal} patientId={patient.id} aiStatus={patient.aiStatus} />

          <div className="rounded-xl border">
            <button
              type="button"
              onClick={() => setShowTriage((value) => !value)}
              className="flex w-full items-center gap-2 p-4 text-left"
            >
              <TestTube2 className="size-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">Triage a patient message</p>
                <p className="text-[10px] text-muted-foreground">Offline rules run instantly; AI refines when online.</p>
              </div>
              <Sparkles className="size-3.5 text-muted-foreground" />
            </button>

            {showTriage && (
              <div className="space-y-3 border-t p-4">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  placeholder="e.g. My chest feels tight and I can't breathe well"
                  className="w-full resize-none rounded-xl border bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary/40"
                  disabled={!canTriage || triaging}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {online ? 'Online: local rules + Gemini.' : 'Offline: local rules, AI queued.'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => void runTriage()}
                    disabled={!message.trim() || !canTriage}
                    loading={triaging}
                    startIcon={!triaging ? <Send className="size-3.5" /> : undefined}
                  >
                    {triaging ? 'Triaging…' : 'Triage'}
                  </Button>
                </div>

                {triageResult && (
                  <div className="space-y-2 rounded-lg border bg-secondary/30 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge score={triageResult.result.riskScore} />
                      {triageResult.queued && (
                        <span className="rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-medium text-info">
                          Queued for AI analysis
                        </span>
                      )}
                      {triageResult.alertCreated && (
                        <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Alert recorded
                        </span>
                      )}
                    </div>
                    {triageResult.result.triggeredFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {triageResult.result.triggeredFlags.map((flag) => (
                          <span key={flag} className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] leading-relaxed text-foreground">{triageResult.result.botResponse}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {triageResult.result.provenance.model} · {triageResult.result.provenance.promptVersion}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border">
            <div className="flex items-center gap-2 border-b p-4">
              <MessageSquarePlus className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Clinical notes</p>
              <span className="ml-auto text-[10px] text-muted-foreground">{notes.length} saved</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="relative">
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Write a note about this patient…"
                  className="w-full resize-none rounded-xl border bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary/40"
                />
                <Button
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => void saveNote()}
                  loading={savingNote}
                  disabled={!note.trim()}
                  startIcon={!savingNote ? <Send className="size-3" /> : undefined}
                >
                  Save
                </Button>
              </div>

              {notes.length === 0 && (
                <p className="py-2 text-center text-[11px] text-muted-foreground">
                  Notes are stored locally first, then synced with a full audit trail.
                </p>
              )}

              <div className="space-y-2.5">
                {notes.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-secondary/20 p-3">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{item.body}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {item.authorName} · {formatDateTime(item.createdAt)}
                      {item.syncState === 'pending' && (
                        <>
                          <CloudOff className="size-2.5 text-warning" /> pending sync
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Manual risk override triggers a clinician audit entry.
            </p>
            <select
              value={patient.riskScore}
              onChange={(event) => void changeRisk(event.target.value as RiskScore)}
              className="h-7 rounded-full border bg-background px-2 text-[11px] font-medium capitalize outline-none sm:hidden"
            >
              {RISK_OPTIONS.map((risk) => (
                <option key={risk} value={risk}>
                  {titleCase(risk)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {triaging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-background px-8 py-6 shadow-lg">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-foreground">Analyzing patient message</p>
            <p className="text-[10px] text-muted-foreground">Local rules first · cloud AI if available</p>
          </div>
        </div>
      )}
    </div>
  )
}
