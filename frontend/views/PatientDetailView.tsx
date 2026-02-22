'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePatients } from '@/context/PatientsContext'
import PatientDetailHeader from '@/components/provider/PatientDetailHeader'
import ActiveAlerts from '@/components/provider/ActiveAlerts'
import InterventionBar from '@/components/provider/InterventionBar'
import CheckInTimeline from '@/components/provider/CheckInTimeline'
import SignalSummary from '@/components/provider/SignalSummary'
import type { Patient } from '@/types'

export default function PatientDetailView({ patientId }: { patientId: string }) {
  const router = useRouter()
  const { fetchPatient, getPatient } = usePatients()
  const [patient, setPatient] = useState<Patient | null | undefined>(getPatient(patientId))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPatient(patientId).then((p) => {
      if (!p) router.replace('/dashboard')
      else setPatient(p)
      setLoading(false)
    })
  }, [patientId])

  if (loading || !patient) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  const hasActiveAlerts = patient.alerts.some((a) => !a.resolved)

  return (
    <div className="space-y-4">
      <PatientDetailHeader patient={patient} />

      {hasActiveAlerts && (
        <InterventionBar patientName={patient.name} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <ActiveAlerts alerts={patient.alerts} patientId={patient.id} />
          <CheckInTimeline checkIns={patient.checkIns} />
        </div>
        <div>
          <SignalSummary signal={patient.signal} patientId={patient.id} />
        </div>
      </div>
    </div>
  )
}
