'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Patient, RiskScore, CheckIn, Alert, ClinicalSignal } from '@/types'
import { MOCK_PATIENTS } from '@/constant/mockPatients'

type PatientsState = {
  patients: Patient[]
  getPatient: (id: string) => Patient | undefined
  updateRiskScore: (patientId: string, score: RiskScore) => void
  addCheckIn: (patientId: string, checkIn: CheckIn) => void
  addAlert: (patientId: string, alert: Alert) => void
  resolveAlert: (patientId: string, alertId: string) => void
  approveSignal: (patientId: string, signal: ClinicalSignal) => void
}

const PatientsContext = createContext<PatientsState | null>(null)

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(MOCK_PATIENTS)

  function getPatient(id: string) {
    return patients.find((p) => p.id === id)
  }

  function updateRiskScore(patientId: string, score: RiskScore) {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, riskScore: score } : p))
    )
  }

  function addCheckIn(patientId: string, checkIn: CheckIn) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, checkIns: [checkIn, ...p.checkIns], lastCheckIn: checkIn.timestamp }
          : p
      )
    )
  }

  function addAlert(patientId: string, alert: Alert) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, alerts: [alert, ...p.alerts] } : p
      )
    )
  }

  function resolveAlert(patientId: string, alertId: string) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              alerts: p.alerts.map((a) =>
                a.id === alertId ? { ...a, resolved: true } : a
              ),
            }
          : p
      )
    )
  }

  function approveSignal(patientId: string, signal: ClinicalSignal) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, signal, riskScore: 'green' as RiskScore }
          : p
      )
    )
  }

  return (
    <PatientsContext.Provider
      value={{ patients, getPatient, updateRiskScore, addCheckIn, addAlert, resolveAlert, approveSignal }}
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
