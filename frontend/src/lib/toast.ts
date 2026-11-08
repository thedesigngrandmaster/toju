type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  detail?: string
}

type Listener = () => void

let toasts: ToastItem[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, number>()

function emit() {
  listeners.forEach((listener) => listener())
}

function push(type: ToastType, message: string, detail?: string, duration = 4_000) {
  const id = crypto.randomUUID()
  toasts = [...toasts.slice(-3), { id, type, message, detail }]
  emit()
  const timer = window.setTimeout(() => dismiss(id), duration)
  timers.set(id, timer)
}

export function dismiss(id: string): void {
  const timer = timers.get(id)
  if (timer) window.clearTimeout(timer)
  timers.delete(id)
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts(): ToastItem[] {
  return toasts
}

export const toast = {
  success: (message: string, detail?: string) => push('success', message, detail),
  error: (message: string, detail?: string) => push('error', message, detail, 6_000),
  info: (message: string, detail?: string) => push('info', message, detail),
}
