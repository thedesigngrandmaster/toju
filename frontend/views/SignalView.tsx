'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, FileUp, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import PatientIntakeForm, { type IntakeData } from '@/components/signal/PatientIntakeForm'
import NotesUploadArea from '@/components/signal/NotesUploadArea'
import SplitReview from '@/components/signal/SplitReview'
import ApproveButton from '@/components/signal/ApproveButton'
import { usePatients } from '@/context/PatientsContext'
import type { ClinicalSignal } from '@/types'

type Step = 'intake' | 'data-drop' | 'review'

const STEPS: { key: Step; label: string; icon: typeof UserPlus }[] = [
  { key: 'intake', label: 'Patient Info', icon: UserPlus },
  { key: 'data-drop', label: 'Data Drop', icon: FileUp },
  { key: 'review', label: 'Verify & Sync', icon: ShieldCheck },
]

type Props = {
  patientId?: string
}

export default function SignalView({ patientId }: Props) {
  const router = useRouter()
  const { getPatient, addPatient, approveSignal, extractSignal } = usePatients()

  const existingPatient = patientId ? getPatient(patientId) : undefined
  const isExisting = !!existingPatient

  const [step, setStep] = useState<Step>(isExisting ? 'data-drop' : 'intake')
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(patientId ?? null)
  const [intakeData, setIntakeData] = useState<IntakeData | null>(
    existingPatient
      ? { name: existingPatient.name, phoneNumber: existingPatient.phoneNumber, language: existingPatient.language }
      : null
  )
  const [extracting, setExtracting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [signal, setSignal] = useState<ClinicalSignal | null>(null)

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  async function handleIntakeSubmit(data: IntakeData) {
    setIntakeData(data)

    if (!isExisting) {
      try {
        const newId = await addPatient({
          name: data.name,
          phoneNumber: data.phoneNumber,
          language: data.language,
        })
        setCreatedPatientId(newId)
      } catch (err: any) {
        toast.error(err.message || 'Failed to register patient')
        return
      }
    }

    setStep('data-drop')
    toast.success(`Patient ${data.name} registered`)
  }

  async function handleExtract(notes: string) {
    if (!createdPatientId) {
      toast.error('No patient selected')
      return
    }
    setExtracting(true)
    try {
      const extracted = await extractSignal(createdPatientId, notes)
      setSignal(extracted)
      setStep('review')
      toast.success('Clinical signal extracted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract signal')
    } finally {
      setExtracting(false)
    }
  }

  async function handleApprove() {
    if (!signal || !createdPatientId) return
    setApproving(true)
    try {
      await approveSignal(createdPatientId, signal)
      toast.success('Signal verified — monitoring dispatched to patient via WhatsApp')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve signal')
    } finally {
      setApproving(false)
    }
  }

  function handleBack() {
    if (step === 'review') {
      setStep('data-drop')
    } else if (step === 'data-drop' && !isExisting) {
      setStep('intake')
    } else {
      router.back()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="size-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground font-display">
            {isExisting ? 'Extract Signal' : 'New Patient'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {intakeData
              ? `${intakeData.name} · ${intakeData.phoneNumber}`
              : 'Register patient and extract clinical signal'}
          </p>
        </div>
      </div>

      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const isCompleted = i < stepIndex
          const isActive = i === stepIndex
          const isFuture = i > stepIndex

          if (isExisting && s.key === 'intake') return null

          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-6 rounded-full text-xs font-semibold flex items-center justify-center transition-colors',
                    isCompleted && 'bg-primary text-white',
                    isActive && 'bg-primary text-white',
                    isFuture && 'bg-secondary text-muted-foreground'
                  )}
                >
                  {isCompleted ? '✓' : i + (isExisting ? 0 : 1)}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium hidden sm:block',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && !(isExisting && i === 0) && (
                <div
                  className={cn(
                    'h-px flex-1 mx-4',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {step === 'intake' && (
        <PatientIntakeForm
          onSubmit={handleIntakeSubmit}
          initialData={intakeData ?? undefined}
        />
      )}

      {step === 'data-drop' && (
        <div className="space-y-4">
          {intakeData && (
            <div className="border rounded-xl shadow-none p-4 flex items-center gap-4">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserPlus className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{intakeData.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {intakeData.phoneNumber} · {intakeData.language.charAt(0).toUpperCase() + intakeData.language.slice(1)}
                </p>
              </div>
            </div>
          )}
          <NotesUploadArea onSubmit={handleExtract} loading={extracting} />
        </div>
      )}

      {step === 'review' && signal && (
        <div className="space-y-4">
          <SplitReview signal={signal} onSignalChange={setSignal} />
          <div className="flex justify-end">
            <ApproveButton onApprove={handleApprove} loading={approving} />
          </div>
        </div>
      )}
    </div>
  )
}
