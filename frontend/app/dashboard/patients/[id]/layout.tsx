import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Patient Detail',
}

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
