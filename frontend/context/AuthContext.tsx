'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Doctor } from '@/types'
import { api, setAccessToken, getAccessToken } from '@/lib/api'

type AuthState = {
  doctor: Doctor | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const DOCTOR_KEY = 'toju_doctor'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    const stored = localStorage.getItem(DOCTOR_KEY)
    if (token && stored) {
      try {
        setDoctor(JSON.parse(stored))
      } catch {
        localStorage.removeItem(DOCTOR_KEY)
        setAccessToken(null)
      }
    }
    setIsLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const res = await api.auth.login(email, password)
    setAccessToken(res.accessToken)
    const doc: Doctor = {
      id: res.doctor.id,
      name: res.doctor.name,
      specialty: res.doctor.specialty,
      hospital: res.doctor.hospital,
      email: res.doctor.email,
    }
    localStorage.setItem(DOCTOR_KEY, JSON.stringify(doc))
    setDoctor(doc)
  }

  function logout() {
    api.auth.logout().catch(() => {})
    setAccessToken(null)
    localStorage.removeItem(DOCTOR_KEY)
    setDoctor(null)
  }

  return (
    <AuthContext.Provider value={{ doctor, isAuthenticated: !!doctor, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
