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

function generateMockSignal(rawNotes: string): ClinicalSignal {
  return {
    patientSummary:
      'You were treated for a lung infection called pneumonia. You are finishing a course of antibiotics. You also have diabetes, and we need to keep your blood sugar under control. Complete all your medicines and rest at home.',
    medications: [
      { id: 'm1', name: 'Co-amoxiclav (Augmentin)', dose: '625mg', frequency: 'Twice daily for 5 days', status: 'started', confidence: 0.96 },
      { id: 'm2', name: 'Azithromycin', dose: '500mg', frequency: 'Once daily for 3 days', status: 'started', confidence: 0.95 },
      { id: 'm3', name: 'Metformin', dose: '500mg', frequency: 'Twice daily with meals', status: 'continued', confidence: 0.97 },
      { id: 'm4', name: 'Paracetamol', dose: '1g', frequency: 'Every 8 hours as needed', status: 'started', confidence: 0.93 },
      { id: 'm5', name: 'Ibuprofen', dose: '—', frequency: '—', status: 'stopped', confidence: 0.98 },
    ],
    redFlags: [
      'Severe difficulty breathing or cannot complete a full sentence',
      'Lips or fingertips turning blue',
      'Fever above 39.5°C despite paracetamol',
      'Coughing up blood',
      'Confusion or unusual drowsiness',
      'Blood sugar reading above 20',
    ],
    monitoringSchedule: [
      { id: 'ms1', question: 'Did you take your antibiotics today?', frequency: 'daily', time: '08:00' },
      { id: 'ms2', question: 'How is your breathing? Any difficulty?', frequency: 'daily', time: '08:05' },
      { id: 'ms3', question: 'What is your blood sugar reading this morning?', frequency: 'daily', time: '07:00' },
      { id: 'ms4', question: 'Do you have a fever or cough?', frequency: 'daily', time: '08:10' },
    ],
    diagnosis: 'Community-Acquired Pneumonia (Right Lower Lobe) — Moderate Severity',
    rawNotes,
    confidence: 0.94,
    approvedAt: null,
  }
}

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
  const { getPatient, addPatient, approveSignal } = usePatients()

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

  function handleIntakeSubmit(data: IntakeData) {
    setIntakeData(data)

    if (!isExisting) {
      const newId = addPatient({
        name: data.name,
        phoneNumber: data.phoneNumber,
        language: data.language,
      })
      setCreatedPatientId(newId)
    }

    setStep('data-drop')
    toast.success(`Patient ${data.name} registered`)
  }

  async function handleExtract(notes: string) {
    setExtracting(true)
    await new Promise((r) => setTimeout(r, 2500))
    const extracted = generateMockSignal(notes)
    setSignal(extracted)
    setStep('review')
    setExtracting(false)
    toast.success('Clinical signal extracted')
  }

  async function handleApprove() {
    if (!signal || !createdPatientId) return
    setApproving(true)
    await new Promise((r) => setTimeout(r, 1200))
    const approved = { ...signal, approvedAt: new Date().toISOString() }
    approveSignal(createdPatientId, approved)
    toast.success('Signal verified — monitoring dispatched to patient')
    setApproving(false)
    router.push('/dashboard')
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
