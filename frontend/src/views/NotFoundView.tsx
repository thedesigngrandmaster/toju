import { Link } from 'react-router-dom'
import { ArrowLeft, CloudOff } from 'lucide-react'

export default function NotFoundView() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary">
        <CloudOff className="size-5 text-muted-foreground" />
      </div>
      <h1 className="font-display text-lg font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        This page may not have been cached. Return to the dashboard and try again.
      </p>
      <Link
        to="/dashboard"
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-white"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>
    </div>
  )
}
