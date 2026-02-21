import type { Metadata } from 'next'
import PatientTable from '@/components/provider/PatientTable'

export const metadata: Metadata = {
  title: 'Patients',
}

export default function PatientsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Patients
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          All discharged patients under your care
        </p>
      </div>
      <PatientTable />
    </div>
  )
}
