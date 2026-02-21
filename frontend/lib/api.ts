const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1'

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) {
    localStorage.setItem('toju_token', token)
  } else {
    localStorage.removeItem('toju_token')
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('toju_token')
  }
  return accessToken
}

class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = body.error || {}
    throw new ApiError(
      res.status,
      err.code || 'UNKNOWN',
      err.message || `Request failed with status ${res.status}`
    )
  }

  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login(email: string, password: string) {
      return request<{ accessToken: string; doctor: { id: string; name: string; specialty: string; email: string; hospital: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      )
    },
    logout() {
      return request<{ message: string }>('/auth/logout', { method: 'POST' })
    },
    me() {
      return request<{ id: string; name: string; specialty: string; email: string; hospital: string }>('/doctors/me')
    },
  },

  patients: {
    list(params?: { riskScore?: string; search?: string; page?: number; limit?: number }) {
      const qs = new URLSearchParams()
      if (params?.riskScore) qs.set('riskScore', params.riskScore)
      if (params?.search) qs.set('search', params.search)
      if (params?.page) qs.set('page', String(params.page))
      if (params?.limit) qs.set('limit', String(params.limit))
      const query = qs.toString()
      return request<{ patients: any[]; total: number; page: number; totalPages: number }>(
        `/patients${query ? `?${query}` : ''}`
      )
    },
    get(id: string) {
      return request<any>(`/patients/${id}`)
    },
    create(data: { name: string; phoneNumber: string; language: string }) {
      return request<{ id: string; name: string; phoneNumber: string; language: string; riskScore: string; checkInToken: string }>(
        '/patients',
        { method: 'POST', body: JSON.stringify(data) }
      )
    },
    generateSignal(patientId: string, rawNotes: string) {
      return request<any>(
        `/patients/${patientId}/signal`,
        { method: 'POST', body: JSON.stringify({ rawNotes }) }
      )
    },
    approveSignal(patientId: string, signal: any) {
      return request<{ patient: any; dispatched: boolean }>(
        `/patients/${patientId}/signal/approve`,
        { method: 'PATCH', body: JSON.stringify({ signal }) }
      )
    },
    updateRisk(patientId: string, riskScore: string) {
      return request<{ id: string; riskScore: string }>(
        `/patients/${patientId}/risk`,
        { method: 'PATCH', body: JSON.stringify({ riskScore }) }
      )
    },
  },

  alerts: {
    list(unresolved?: boolean) {
      const qs = unresolved ? '?unresolved=true' : ''
      return request<{ alerts: any[] }>(`/alerts${qs}`)
    },
    resolve(alertId: string) {
      return request<{ id: string; resolved: boolean; resolvedAt: string }>(
        `/alerts/${alertId}/resolve`,
        { method: 'PATCH' }
      )
    },
  },

  checkins: {
    list(patientId: string, page = 1) {
      return request<{ checkIns: any[]; total: number; page: number; totalPages: number }>(
        `/patients/${patientId}/checkins?page=${page}`
      )
    },
  },
}
