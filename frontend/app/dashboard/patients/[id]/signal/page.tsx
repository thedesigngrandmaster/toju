'use client'

import { use } from 'react'
import SignalView from '@/views/SignalView'

export default function SignalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <SignalView patientId={id} />
}
