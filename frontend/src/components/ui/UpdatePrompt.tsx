import { useSyncExternalStore } from 'react'
import { RefreshCw } from 'lucide-react'
import { applyServiceWorkerUpdate, getUpdateAvailable, subscribeUpdate } from '@/lib/pwa'

export function UpdatePrompt() {
  const available = useSyncExternalStore(subscribeUpdate, getUpdateAvailable, () => false)
  if (!available) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4 sm:bottom-6">
      <button
        type="button"
        onClick={applyServiceWorkerUpdate}
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-medium text-background shadow-lg"
      >
        <RefreshCw className="size-3.5" />
        New version available — refresh
      </button>
    </div>
  )
}
