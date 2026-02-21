import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Signal Extraction',
}

export default function SignalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
