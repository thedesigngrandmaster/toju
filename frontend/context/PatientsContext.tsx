'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Patient, PatientLanguage, RiskScore, ClinicalSignal } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from './AuthContext'

type NewPatientInput = {
  name: string
  phoneNumber: string
  language: PatientLanguage
}

type PatientsState = {
  patients: Patient[]
  loading: boolean
  refreshPatients: () => Promise<void>
  getPatient: (id: string) => Patient | undefined
  fetchPatient: (id: string) => Promise<Patient | null>
  addPatient: (input: NewPatientInput) => Promise<string>
  resolveAlert: (patientId: string, alertId: string) => Promise<void>
  approveSignal: (patientId: string, signal: ClinicalSignal) => Promise<{ dispatched: boolean; dispatchError?: string }>
  extractSignal: (patientId: string, rawNotes: string) => Promise<ClinicalSignal>
}

const PatientsContext = createContext<PatientsState | null>(null)

function mapPatient(p: any): Patient {
  return {
    id: p.id,
    name: p.name,
    age: p.age ?? 0,
    diagnosis: p.diagnosis,
    admittedDate: p.admittedDate?.split('T')[0] ?? '',
    dischargedDate: p.dischargedDate?.split('T')[0] ?? '',
    doctorId: p.doctorId,
    riskScore: p.riskScore as RiskScore,
    phoneNumber: p.phoneNumber,
    language: (p.language ?? 'english') as PatientLanguage,
    lastCheckIn: p.lastCheckIn ?? null,
    signal: p.signal ?? null,
    checkIns: (p.checkIns ?? []).map((c: any) => ({
      id: c.id,
      timestamp: c.timestamp,
      message: c.message,
      riskScore: c.riskScore,
      triggeredFlags: c.triggeredFlags ?? [],
      botResponse: c.botResponse,
    })),
    alerts: (p.alerts ?? []).map((a: any) => ({
      id: a.id,
      timestamp: a.timestamp,
      type: a.type,
      message: a.message,
      resolved: a.resolved,
    })),
  }
}

export function PatientsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)

  const refreshPatients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.patients.list({ limit: 50 })
      setPatients(res.patients.map(mapPatient))
    } catch (err) {
      console.error('Failed to fetch patients:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      refreshPatients()
    } else {
      setPatients([])
    }
  }, [isAuthenticated, refreshPatients])

  function getPatient(id: string) {
    return patients.find((p) => p.id === id)
  }

  async function fetchPatient(id: string): Promise<Patient | null> {
    try {
      const raw = await api.patients.get(id)
      const patient = mapPatient(raw)
      setPatients((prev) => {
        const exists = prev.find((p) => p.id === id)
        if (exists) return prev.map((p) => (p.id === id ? patient : p))
        return [patient, ...prev]
      })
      return patient
    } catch {
      return null
    }
  }

  async function addPatient(input: NewPatientInput): Promise<string> {
    const res = await api.patients.create(input)
    await refreshPatients()
    return res.id
  }

  async function resolveAlert(_patientId: string, alertId: string): Promise<void> {
    await api.alerts.resolve(alertId)
    await refreshPatients()
  }

  async function extractSignal(patientId: string, rawNotes: string): Promise<ClinicalSignal> {
    const signal = await api.patients.generateSignal(patientId, rawNotes)
    return {
      patientSummary: signal.patientSummary,
      medications: signal.medications.map((m: any, i: number) => ({ ...m, id: m.id || `m${i}` })),
      redFlags: signal.redFlags,
      monitoringSchedule: signal.monitoringSchedule.map((s: any, i: number) => ({ ...s, id: s.id || `ms${i}` })),
      diagnosis: signal.diagnosis,
      rawNotes: signal.rawNotes,
      confidence: signal.confidence,
      approvedAt: null,
    }
  }

  async function approveSignal(patientId: string, signal: ClinicalSignal): Promise<{ dispatched: boolean; dispatchError?: string }> {
    const res = await api.patients.approveSignal(patientId, signal)
    await refreshPatients()
    return { dispatched: res.dispatched, dispatchError: (res as any).dispatchError }
  }

  return (
    <PatientsContext.Provider
      value={{ patients, loading, refreshPatients, getPatient, fetchPatient, addPatient, resolveAlert, approveSignal, extractSignal }}
    >
      {children}
    </PatientsContext.Provider>
  )
}

export function usePatients() {
  const ctx = useContext(PatientsContext)
  if (!ctx) throw new Error('usePatients must be used inside PatientsProvider')
  return ctx
}
