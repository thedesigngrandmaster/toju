import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileUp, ShieldCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { usePatient } from '@/hooks/useLocalData'
import { PatientIntakeForm, type IntakeData } from '@/components/signal/PatientIntakeForm'
import { NotesUploadArea } from '@/components/signal/NotesUploadArea'
import { SignalReview } from '@/components/signal/SignalReview'
import { Spinner } from '@/components/ui/Spinner'
import { cn, titleCase } from '@/lib/utils'
import { createPatientLocal, approveSignalLocal } from '@/lib/repository'
import { requestSignalExtraction } from '@/lib/ai'
import { toast } from '@/lib/toast'
import type { ClinicalSignal } from '@/types'

type Step = 'intake' | 'data-drop' | 'review'

const STEPS: { key: Step; label: string; icon: typeof UserPlus }[] = [
  { key: 'intake', label: 'Patient info', icon: UserPlus },
  { key: 'data-drop', label: 'Data drop', icon: FileUp },
  { key: 'review', label: 'Verify & sync', icon: ShieldCheck },
]

export default function SignalView() {
  const { patientId: routePatientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { doctor } = useAuth()
  const online = useIsOnline()

  const [createdPatientId, setCreatedPatientId] = useState<string | null>(routePatientId ?? null)
  const activePatientId = createdPatientId ?? routePatientId ?? undefined
  const { bundle, loading } = usePatient(activePatientId)
  const patient = bundle?.patient

  const [step, setStep] = useState<Step>(routePatientId ? 'data-drop' : 'intake')
  const [intake, setIntake] = useState<IntakeData | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [queued, setQueued] = useState(false)
  const [signal, setSignal] = useState<ClinicalSignal | null>(null)
  const [approving, setApproving] = useState(false)
  const [creating, setCreating] = useState(false)

  // If a queued extraction completes in the background, transition to review.
  useEffect(() => {
    if (
      queued &&
      patient?.aiStatus === 'ready' &&
      patient.signal &&
      !patient.signal.approvedAt
    ) {
      setSignal(patient.signal)
      setQueued(false)
      setStep('review')
      toast.success('AI signal extracted', 'Review it and verify when ready.')
    }
  }, [queued, patient?.aiStatus, patient?.signal])

  useEffect(() => {
    if (patient && !intake) {
      setIntake({
        name: patient.name,
        phoneNumber: patient.phoneNumber,
        language: patient.language,
      })
    }
  }, [patient, intake])

  if (routePatientId && loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="size-5 text-primary" />
      </div>
    )
  }

  if (routePatientId && !loading && !patient) {
    return (
      <div className="rounded-xl border p-10 text-center">
        <p className="text-sm font-medium text-foreground">Patient not cached on this device</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Connect once to download the patient record, then signal extraction can run offline.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/patients')}
          className="mt-4 text-xs font-medium text-primary"
        >
          Back to patients
        </button>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((item) => item.key === step)
  const isExisting = Boolean(routePatientId || createdPatientId)

  async function handleIntake(data: IntakeData) {
    if (!doctor) return
    setIntake(data)
    setCreating(true)
    try {
      const created = await createPatientLocal(data, doctor.id)
      setCreatedPatientId(created.id)
      setStep('data-drop')
      toast.success(`${created.name} registered`, 'Saved locally; syncing in the background.')
    } catch (error) {
      toast.error('Could not register patient', error instanceof Error ? error.message : undefined)
    } finally {
      setCreating(false)
    }
  }

  async function handleExtract(notes: string) {
    if (!activePatientId) return
    setExtracting(true)
    setQueued(false)
    try {
      const outcome = await requestSignalExtraction(activePatientId, notes)
      if (outcome.queued) {
        setQueued(true)
        toast.info('Queued for AI analysis', 'Notes are saved. Extraction runs automatically when online.')
      } else {
        setSignal(outcome.signal)
        setStep('review')
        toast.success('Clinical signal extracted')
      }
    } catch (error) {
      toast.error('Signal extraction failed', error instanceof Error ? error.message : undefined)
    } finally {
      setExtracting(false)
    }
  }

  async function handleApprove() {
    if (!signal || !activePatientId || !doctor) return
    setApproving(true)
    try {
      await approveSignalLocal(activePatientId, signal, doctor.id)
      toast.success(
        online ? 'Signal verified and queued for dispatch' : 'Signal approved locally',
        online
          ? 'The WhatsApp welcome message is handled by the durable server queue.'
          : 'The approval and WhatsApp message will sync when you reconnect.',
      )
      navigate('/dashboard')
    } catch (error) {
      toast.error('Could not approve signal', error instanceof Error ? error.message : undefined)
    } finally {
      setApproving(false)
    }
  }

  function handleBack() {
    if (step === 'review') setStep('data-drop')
    else if (step === 'data-drop' && !isExisting) setStep('intake')
    else navigate(-1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
            {isExisting ? 'Extract signal' : 'New patient'}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {intake
              ? `${intake.name} · ${intake.phoneNumber} · ${titleCase(intake.language)}`
              : 'Register a patient and extract their clinical signal'}
          </p>
        </div>
        {!online && (
          <span className="rounded-full bg-warning-bg px-2.5 py-1 text-[10px] font-medium text-warning">
            Offline · saved locally
          </span>
        )}
      </div>

      <div className="flex items-center">
        {STEPS.map((item, index) => {
          if (isExisting && item.key === 'intake') return null
          const completed = index < stepIndex
          const active = index === stepIndex
          return (
            <div key={item.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-[11px] font-semibold',
                    completed || active ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {completed ? '✓' : index + 1}
                </span>
                <span className={cn('hidden text-xs font-medium sm:block', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              </div>
              {index < STEPS.length - 1 && !(isExisting && index === 0) && (
                <div className={cn('mx-3 h-px flex-1', completed ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          )
        })}
      </div>

      {step === 'intake' && (
        <PatientIntakeForm
          onSubmit={(data) => void handleIntake(data)}
          initialData={intake ?? undefined}
          loading={creating}
        />
      )}

      {step === 'data-drop' && (
        <div className="space-y-3">
          {intake && (
            <div className="flex items-center gap-3 rounded-xl border p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{intake.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {intake.phoneNumber} · {titleCase(intake.language)}
                </p>
              </div>
              {patient?.syncState === 'pending' && (
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-medium text-warning">
                  Pending sync
                </span>
              )}
            </div>
          )}

          <NotesUploadArea
            onSubmit={(notes) => void handleExtract(notes)}
            loading={extracting}
            queued={queued}
          />

          {queued && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full rounded-xl border p-3 text-center text-xs font-medium text-primary"
            >
              Return to dashboard — extraction will continue in the background
            </button>
          )}
        </div>
      )}

      {step === 'review' && signal && (
        <SignalReview
          signal={signal}
          onChange={setSignal}
          onApprove={() => void handleApprove()}
          approving={approving}
          offline={!online}
        />
      )}
    </div>
  )
}
