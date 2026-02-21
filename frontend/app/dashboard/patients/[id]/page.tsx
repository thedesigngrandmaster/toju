'use client'

import { use } from 'react'
import PatientDetailView from '@/views/PatientDetailView'

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <PatientDetailView patientId={id} />
}
