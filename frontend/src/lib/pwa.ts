import { scheduleSync } from './sync'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'toju_install_dismissed_at'
let deferredPrompt: BeforeInstallPromptEvent | null = null
let updateRegistration: ServiceWorkerRegistration | null = null
let updateCallback: (() => void) | null = null
let updateAvailable = false
const listeners = new Set<() => void>()
const updateListeners = new Set<() => void>()
let installState: 'installable' | 'ios' | 'installed' | 'none' = 'none'

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPhoneLike = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iPhoneLike || iPadOs
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function recomputeInstallState(): void {
  if (isStandalone()) installState = 'installed'
  else if (deferredPrompt) installState = 'installable'
  else if (isIosDevice()) installState = 'ios'
  else installState = 'none'
  listeners.forEach((listener) => listener())
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPwaSnapshot(): string {
  return installState
}

export function subscribeUpdate(listener: () => void): () => void {
  updateListeners.add(listener)
  return () => updateListeners.delete(listener)
}

export function getUpdateAvailable(): boolean {
  return updateAvailable
}

function markUpdateAvailable(): void {
  updateAvailable = true
  updateListeners.forEach((listener) => listener())
  updateCallback?.()
}

export function getInstallState(): typeof installState {
  return installState
}

export function wasInstallPromptDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const days = (Date.now() - Number(raw)) / 86_400_000
    return days < 7
  } catch {
    return false
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  if (choice.outcome === 'accepted') {
    deferredPrompt = null
    recomputeInstallState()
  }
  return choice.outcome
}

export function isIos(): boolean {
  return isIosDevice()
}

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

/**
 * Registers the service worker and wires update/install events. Safe to call
 * once from main.tsx.
 */
export async function initPwa(onUpdateAvailable: () => void): Promise<void> {
  if (typeof window === 'undefined') return
  updateCallback = onUpdateAvailable

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    recomputeInstallState()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    recomputeInstallState()
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', recomputeInstallState)
  recomputeInstallState()

  if (!isServiceWorkerSupported()) return
  // The service worker is only emitted by the production build. Registering it
  // in dev makes Vite serve index.html for /sw.js and logs a MIME-type error.
  if (import.meta.env.DEV) return

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string } | undefined
    if (data?.type === 'TOJU_RUN_SYNC' || data?.type === 'TOJU_SYNC_COMPLETE') {
      scheduleSync(200)
    }
  })

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    updateRegistration = registration

    if (registration.waiting) markUpdateAvailable()
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          markUpdateAvailable()
        }
      })
    })

    // Poll for updates when the app regains focus (iOS never auto-updates a
    // standalone PWA until it is fully closed and reopened).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => undefined)
    })
  } catch (error) {
    console.warn('[pwa] Service worker registration failed', error)
  }
}

export function applyServiceWorkerUpdate(): void {
  updateAvailable = false
  updateListeners.forEach((listener) => listener())
  if (!updateRegistration?.waiting) {
    window.location.reload()
    return
  }
  updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
  let reloaded = false
  const reload = () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
  setTimeout(reload, 1_500)
}

/** Ask the browser to keep IndexedDB data. iOS may deny this silently. */
export async function ensurePersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
