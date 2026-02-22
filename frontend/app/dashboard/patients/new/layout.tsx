import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'New Patient — Signal Extraction',
}

export default function NewPatientLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
