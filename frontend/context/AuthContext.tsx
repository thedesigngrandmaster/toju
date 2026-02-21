'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Doctor } from '@/types'
import { DEMO_CREDENTIALS, DEMO_DOCTOR } from '@/constant/mockPatients'

type AuthState = {
  doctor: Doctor | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'carebridge_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setDoctor(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  async function login(email: string, password: string) {
    if (
      email.trim().toLowerCase() !== DEMO_CREDENTIALS.email ||
      password !== DEMO_CREDENTIALS.password
    ) {
      throw new Error('Invalid credentials. Use the demo credentials shown below.')
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_DOCTOR))
    setDoctor(DEMO_DOCTOR)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setDoctor(null)
  }

  return (
    <AuthContext.Provider value={{ doctor, isAuthenticated: !!doctor, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}