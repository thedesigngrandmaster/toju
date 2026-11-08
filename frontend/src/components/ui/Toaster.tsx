import { useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { dismiss, getToasts, subscribeToasts } from '@/lib/toast'
import { cn } from '@/lib/utils'

const config = {
  success: { icon: CheckCircle2, className: 'border-success/25 text-success' },
  error: { icon: AlertTriangle, className: 'border-destructive/25 text-destructive' },
  info: { icon: Info, className: 'border-info/25 text-info' },
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-end sm:pr-4">
      {toasts.map((toast) => {
        const c = config[toast.type]
        const Icon = c.icon
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-background p-3 shadow-lg animate-fade-up',
              c.className,
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{toast.message}</p>
              {toast.detail && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{toast.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
