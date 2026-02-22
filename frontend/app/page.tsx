import type { Metadata } from 'next'
import LandingView from '@/views/LandingView'

export const metadata: Metadata = {
  title: 'Toju — AI Post-Discharge Monitoring',
  description:
    'Toju turns messy discharge notes into proactive, AI-powered patient monitoring — closing the loop between hospital and home.',
}

export default function HomePage() {
  return <LandingView />
}