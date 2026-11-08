import type {
  ExtractSignalResponse,
  OutboundMessage,
  PatientDetailDTO,
  PatientSummaryDTO,
  SyncPullResponse,
  SyncPushOperation,
  SyncPushResult,
  TriageResponse,
  WhatsAppStatus,
} from '@/types'
import { getToken, setToken } from './auth-store'
import { markNetworkResult } from './network'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/v1'

let onAuthExpired: (() => void) | null = null
let refreshInFlight: Promise<boolean> | null = null

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  onAuthExpired = handler
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const nested = body.error as { code?: string; message?: string } | string | undefined
  const code =
    (typeof nested === 'object' && nested?.code) ||
    (typeof body.code === 'string' ? body.code : undefined) ||
    'UNKNOWN'
  const message =
    (typeof nested === 'object' && nested?.message) ||
    (typeof nested === 'string' ? nested : undefined) ||
    (typeof body.message === 'string' ? body.message : undefined) ||
    `Request failed with status ${res.status}`
  return new ApiError(res.status, code, message)
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) return false
      const body = (await res.json()) as { accessToken?: string }
      if (!body.accessToken) return false
      await setToken(body.accessToken)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
  allowRefresh?: boolean
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 20_000, allowRefresh = true, headers, ...rest } = options
  const token = getToken()
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) || {}),
  }
  if (token) requestHeaders.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: requestHeaders,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (err) {
    markNetworkResult(false)
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    throw new ApiError(
      0,
      aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      aborted ? 'The request timed out.' : 'You appear to be offline.',
    )
  } finally {
    clearTimeout(timer)
  }

  markNetworkResult(true)

  if (res.status === 401 && allowRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return rawRequest<T>(path, { ...options, allowRefresh: false })
    }
    onAuthExpired?.()
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  base: API_BASE,

  auth: {
    login(email: string, password: string) {
      return rawRequest<{
        accessToken: string
        doctor: { id: string; name: string; specialty: string; email: string; hospital: string }
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        allowRefresh: false,
      })
    },
    logout() {
      return rawRequest<{ message: string }>('/auth/logout', { method: 'POST' }).catch(() => ({
        message: 'Logged out locally',
      }))
    },
    me() {
      return rawRequest<{
        id: string
        name: string
        specialty: string
        email: string
        hospital: string
      }>('/doctors/me')
    },
  },

  patients: {
    list(params: { riskScore?: string; search?: string; page?: number; limit?: number } = {}) {
      const qs = new URLSearchParams()
      if (params.riskScore) qs.set('riskScore', params.riskScore)
      if (params.search) qs.set('search', params.search)
      if (params.page) qs.set('page', String(params.page))
      if (params.limit) qs.set('limit', String(params.limit))
      const query = qs.toString()
      return rawRequest<{
        patients: PatientSummaryDTO[]
        total: number
        page: number
        totalPages: number
      }>(`/patients${query ? `?${query}` : ''}`)
    },
    get(id: string) {
      return rawRequest<PatientDetailDTO>(`/patients/${id}`)
    },
    create(data: { name: string; phoneNumber: string; language: string; age?: number }) {
      return rawRequest<{ id: string; name: string; phoneNumber: string; language: string; riskScore: string }>(
        '/patients',
        { method: 'POST', body: JSON.stringify(data) },
      )
    },
    generateSignal(patientId: string, rawNotes: string) {
      return rawRequest<ExtractSignalResponse>(`/patients/${patientId}/signal`, {
        method: 'POST',
        body: JSON.stringify({ rawNotes }),
        timeoutMs: 45_000,
      })
    },
    approveSignal(patientId: string, signal: unknown) {
      return rawRequest<{ patient: PatientDetailDTO; dispatched: boolean; dispatchError?: string }>(
        `/patients/${patientId}/signal/approve`,
        { method: 'PATCH', body: JSON.stringify({ signal }) },
      )
    },
    updateRisk(patientId: string, riskScore: string) {
      return rawRequest<{ id: string; riskScore: string }>(`/patients/${patientId}/risk`, {
        method: 'PATCH',
        body: JSON.stringify({ riskScore }),
      })
    },
  },

  alerts: {
    list(unresolved = false) {
      return rawRequest<{ alerts: unknown[] }>(`/alerts${unresolved ? '?unresolved=true' : ''}`)
    },
    resolve(alertId: string) {
      return rawRequest<{ id: string; resolved: boolean; resolvedAt: string }>(
        `/alerts/${alertId}/resolve`,
        { method: 'PATCH' },
      )
    },
  },

  checkins: {
    list(patientId: string, page = 1) {
      return rawRequest<{ checkIns: unknown[]; total: number; page: number; totalPages: number }>(
        `/patients/${patientId}/checkins?page=${page}`,
      )
    },
  },

  sync: {
    push(deviceId: string, operations: SyncPushOperation[]) {
      return rawRequest<{ results: SyncPushResult[]; serverTime: string }>('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ deviceId, operations }),
        timeoutMs: 30_000,
      })
    },
    pull(since: string | null) {
      const qs = since ? `?since=${encodeURIComponent(since)}` : ''
      return rawRequest<SyncPullResponse>(`/sync/pull${qs}`, { timeoutMs: 30_000 })
    },
  },

  ai: {
    triage(input: {
      patientId: string
      message: string
      language: string
      localRisk?: string
      localFlags?: string[]
    }) {
      return rawRequest<TriageResponse>('/ai/triage', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 45_000,
      })
    },
  },

  notes: {
    create(patientId: string, body: string) {
      return rawRequest<{ id: string; createdAt: string }>(`/patients/${patientId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
    },
  },

  whatsapp: {
    status() {
      return rawRequest<WhatsAppStatus>('/whatsapp/status')
    },
    qr() {
      return rawRequest<{ ready: boolean; state: string; qr: string | null }>(
        `/whatsapp/qr?t=${Date.now()}`,
      )
    },
    outbox() {
      return rawRequest<{ messages: OutboundMessage[]; counts: Record<string, number> }>(
        '/whatsapp/outbox',
      )
    },
    retry(messageId: string) {
      return rawRequest<{ ok: boolean }>(`/whatsapp/outbox/${messageId}/retry`, {
        method: 'POST',
      })
    },
  },
}

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health', { cache: 'no-store' })
    markNetworkResult(res.ok)
    return res.ok
  } catch {
    markNetworkResult(false)
    return false
  }
}
