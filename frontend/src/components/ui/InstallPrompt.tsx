import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
import { useInstallState } from '@/hooks/useInstallState'
import {
  dismissInstallPrompt,
  promptInstall,
  wasInstallPromptDismissed,
} from '@/lib/pwa'
import { toast } from '@/lib/toast'

export function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const state = useInstallState()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => wasInstallPromptDismissed())

  if (hidden || state === 'installed' || state === 'none') return null

  async function install() {
    if (state === 'ios') {
      setOpen(true)
      return
    }
    const outcome = await promptInstall()
    if (outcome === 'accepted') {
      toast.success('Toju installed. Open it from your home screen.')
      setHidden(true)
    }
  }

  function dismiss() {
    dismissInstallPrompt()
    setHidden(true)
  }

  if (compact) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => void install()} startIcon={<Download className="size-3.5" />}>
          Install app
        </Button>
        <IosInstructions open={open} onClose={() => setOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="size-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-semibold text-foreground">Install Toju for offline use</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {state === 'ios'
                ? 'Add Toju to your Home Screen for full-screen, offline-capable access.'
                : 'Launch Toju from your home screen and keep working without a connection.'}
            </p>
            <Button size="sm" className="mt-2.5" onClick={() => void install()} startIcon={<Download className="size-3.5" />}>
              {state === 'ios' ? 'How to install' : 'Install app'}
            </Button>
          </div>
        </div>
      </div>
      <IosInstructions open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function IosInstructions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Install Toju on iPhone / iPad">
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          iOS installs Progressive Web Apps through Safari. This gives Toju a full-screen app icon and
          lets it work offline.
        </p>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Share className="size-3.5 text-primary" />
            </span>
            <p className="text-xs leading-relaxed text-foreground">
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
              <SquarePlus className="size-3.5 text-primary" />
            </span>
            <p className="text-xs leading-relaxed text-foreground">
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-primary">
              3
            </span>
            <p className="text-xs leading-relaxed text-foreground">
              Tap <strong>Add</strong>, then open Toju from your Home Screen. Sign in once while online so
              your patient list is available offline.
            </p>
          </li>
        </ol>
        <div className="rounded-lg bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Note: iOS may limit background sync and storage. Toju saves every change immediately and syncs
          when you reopen the app or regain connectivity. Avoid clearing Safari website data.
        </div>
        <Button fullWidth onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  )
}
