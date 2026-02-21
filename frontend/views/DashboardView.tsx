'use client'

import DashboardHeader from '@/components/provider/DashboardHeader'
import AlertBanner from '@/components/provider/AlertBanner'
import PatientTable from '@/components/provider/PatientTable'

export default function DashboardView() {
  return (
    <div className="space-y-4">
      <DashboardHeader />
      <AlertBanner />
      <PatientTable />
    </div>
  )
}
