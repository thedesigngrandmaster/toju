'use client'

import { useEffect } from 'react'
import DashboardHeader from '@/components/provider/DashboardHeader'
import AlertBanner from '@/components/provider/AlertBanner'
import PatientTable from '@/components/provider/PatientTable'
import { usePatients } from '@/context/PatientsContext'

export default function DashboardView() {
  const { loading, refreshPatients } = usePatients()

  useEffect(() => {
    const interval = setInterval(() => {
      refreshPatients()
    }, 30_000)
    return () => clearInterval(interval)
  }, [refreshPatients])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <AlertBanner />
      <PatientTable />
    </div>
  )
}
