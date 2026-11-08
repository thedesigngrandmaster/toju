import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Doctor } from '@/types'
import { api, setAuthExpiredHandler } from '@/lib/api'
import {
  clearAuth,
  getCachedDoctor,
  getIndexedDoctor,
  loadAuthFromCache,
  setDoctor as persistDoctor,
  setToken,
} from '@/lib/auth-store'
import { clearClinicalData, db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { forceFullSync } from '@/lib/sync'
import { toast } from '@/lib/toast'

interface AuthContextValue {
  doctor: Doctor | null
  isAuthenticated: boolean
  isLoading: boolean
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  wipeLocalData: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const LAST_DOCTOR_KEY = 'toju_last_doctor_id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctorState] = useState<Doctor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const cached = loadAuthFromCache()
      let nextDoctor = cached.doctor

      if (!nextDoctor) {
        nextDoctor = await getIndexedDoctor()
      }

      if (cancelled) return
      setDoctorState(nextDoctor)
      if (cached.token) await setToken(cached.token)
      setIsLoading(false)

      // Validate the session in the background — never block the UI.
      if (nextDoctor && navigator.onLine) {
        try {
          const fresh = await api.auth.me()
          if (cancelled) return
          const normalized: Doctor = { ...fresh }
          setDoctorState(normalized)
          await persistDoctor(normalized)
        } catch {
          // Offline-first: keep the cached identity and let the user continue.
        }
      }
    }

    void boot()

    setAuthExpiredHandler(() => {
      setSessionExpired(true)
    })

    return () => {
      cancelled = true
      setAuthExpiredHandler(null)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (!navigator.onLine) {
      throw new Error('First sign-in requires an internet connection. Use the app offline after signing in once.')
    }
    const response = await api.auth.login(email, password)
    const nextDoctor: Doctor = { ...response.doctor }

    const previousId = localStorage.getItem(LAST_DOCTOR_KEY)
    if (previousId && previousId !== nextDoctor.id) {
      // Shared device: never expose another clinician's cached PHI.
      await clearClinicalData()
    }

    await setToken(response.accessToken)
    await persistDoctor(nextDoctor)
    setDoctorState(nextDoctor)
    setSessionExpired(false)
    localStorage.setItem(LAST_DOCTOR_KEY, nextDoctor.id)

    await logAudit({
      actor: 'clinician',
      action: 'auth.login',
      entityType: 'doctor',
      entityId: nextDoctor.id,
      summary: `${nextDoctor.name} signed in`,
    })

    toast.success(`Welcome back, ${nextDoctor.name.split(' ').slice(0, 2).join(' ')}.`)
    // Pull everything this clinician needs for offline use.
    setTimeout(() => void forceFullSync(), 300)
  }, [])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => undefined)
    await clearAuth()
    setDoctorState(null)
    setSessionExpired(false)
    toast.info('Signed out. Local clinical data remains protected on this device.')
  }, [])

  const wipeLocalData = useCallback(async () => {
    await clearClinicalData()
    await db.meta.delete('lastSyncAt')
    toast.success('Local patient data wiped from this device.')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      doctor,
      isAuthenticated: Boolean(doctor),
      isLoading,
      sessionExpired,
      login,
      logout,
      wipeLocalData,
    }),
    [doctor, isLoading, sessionExpired, login, logout, wipeLocalData],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
