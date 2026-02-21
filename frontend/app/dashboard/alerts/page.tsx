import type { Metadata } from 'next'
import AlertsList from '@/components/provider/AlertsList'

export const metadata: Metadata = {
  title: 'Alerts',
}

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Alerts
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Red flags and missed check-ins across all patients
        </p>
      </div>
      <AlertsList />
    </div>
  )
}
