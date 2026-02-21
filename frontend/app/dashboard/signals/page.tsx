import type { Metadata } from 'next'
import SignalsList from '@/components/provider/SignalsList'

export const metadata: Metadata = {
  title: 'Signals',
}

export default function SignalsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Clinical Signals
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI-extracted care plans from discharge notes
        </p>
      </div>
      <SignalsList />
    </div>
  )
}
