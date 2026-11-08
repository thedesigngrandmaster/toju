/**
 * Connectivity state with an explicit development simulation switch.
 *
 * navigator.onLine is famously unreliable (captive portals, half-open cellular
 * connections). We treat it as a hint and combine it with an active API probe.
 * The UI never blocks on connectivity – this module only drives badges and the
 * background sync engine.
 */

const SIMULATED_OFFLINE_KEY = 'toju_simulated_offline'

type Listener = () => void

let simulatedOffline = false
let reachable = true
let lastProbeAt = 0
let probeTimer: number | undefined
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function initNetworkState(): void {
  if (typeof window === 'undefined') return
  try {
    simulatedOffline = localStorage.getItem(SIMULATED_OFFLINE_KEY) === '1'
  } catch {
    simulatedOffline = false
  }
  reachable = navigator.onLine

  window.addEventListener('online', () => {
    reachable = true
    emit()
    void probeApi()
  })
  window.addEventListener('offline', () => {
    reachable = false
    emit()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probeApi()
  })

  window.clearInterval(probeTimer)
  probeTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && !simulatedOffline) {
      void probeApi()
    }
  }, 30_000)

  if (navigator.onLine && !simulatedOffline) void probeApi()
}

export function subscribeNetwork(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getNetworkSnapshot(): string {
  if (simulatedOffline) return 'simulated-offline'
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  return reachable ? 'online' : 'unreachable'
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  if (simulatedOffline) return false
  return navigator.onLine && reachable
}

export function isSimulatedOffline(): boolean {
  return simulatedOffline
}

export function setSimulatedOffline(value: boolean): void {
  simulatedOffline = value
  try {
    localStorage.setItem(SIMULATED_OFFLINE_KEY, value ? '1' : '0')
  } catch {
    /* private mode */
  }
  if (!value && navigator.onLine) {
    reachable = true
    void probeApi()
  }
  emit()
}

export function markNetworkResult(ok: boolean): void {
  if (reachable !== ok) {
    reachable = ok
    emit()
  }
}

export async function probeApi(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (!navigator.onLine || simulatedOffline)) {
    markNetworkResult(false)
    return false
  }
  // Avoid hammering the API when many components mount at once.
  if (Date.now() - lastProbeAt < 3_000) return reachable
  lastProbeAt = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4_000)
    const res = await fetch('/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    markNetworkResult(res.ok)
    return res.ok
  } catch {
    markNetworkResult(false)
    return false
  }
}

/** True when the browser supports the Background Sync API (Chromium only). */
export function supportsBackgroundSync(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window
}

export function supportsPeriodicSync(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'periodicSync' in ServiceWorkerRegistration.prototype
  )
}
