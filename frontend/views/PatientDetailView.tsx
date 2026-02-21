'use client'

import { useRouter } from 'next/navigation'
import { usePatients } from '@/context/PatientsContext'
import PatientDetailHeader from '@/components/provider/PatientDetailHeader'
import ActiveAlerts from '@/components/provider/ActiveAlerts'
import InterventionBar from '@/components/provider/InterventionBar'
import CheckInTimeline from '@/components/provider/CheckInTimeline'
import SignalSummary from '@/components/provider/SignalSummary'

export default function PatientDetailView({ patientId }: { patientId: string }) {
  const router = useRouter()
  const { getPatient } = usePatients()
  const patient = getPatient(patientId)

  if (!patient) {
    router.replace('/dashboard')
    return null
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
