import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/db'
import type { Alert, CheckIn, Note, Patient, RiskScore } from '@/types'

const RISK_ORDER: Record<RiskScore, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  unmonitored: 3,
}

export function usePatients() {
  const { doctor } = useAuth()
  const patients = useLiveQuery(
    async () => {
      if (!doctor) return []
      const rows = await db.patients.where('doctorId').equals(doctor.id).toArray()
      return rows.sort(
        (a, b) =>
          RISK_ORDER[a.riskScore] - RISK_ORDER[b.riskScore] ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
    },
    [doctor?.id],
    [] as Patient[],
  )

  return { patients, loading: patients === undefined }
}

export function usePatient(patientId: string | undefined) {
  const data = useLiveQuery(
    async () => {
      if (!patientId) return null
      const [patient, checkIns, alerts, notes] = await Promise.all([
        db.patients.get(patientId),
        db.checkIns.where('patientId').equals(patientId).toArray(),
        db.alerts.where('patientId').equals(patientId).toArray(),
        db.notes.where('patientId').equals(patientId).toArray(),
      ])
      if (!patient) return null
      return {
        patient,
        checkIns: checkIns.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as CheckIn[],
        alerts: alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as Alert[],
        notes: notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as Note[],
      }
    },
    [patientId],
    null,
  )

  return { bundle: data, loading: data === undefined }
}

export function usePendingOutbox() {
  return useLiveQuery(
    async () => {
      const ops = await db.outbox.toArray()
      return {
        total: ops.length,
        pending: ops.filter((op) => op.status === 'pending' || op.status === 'syncing').length,
        failed: ops.filter((op) => op.status === 'failed' || op.status === 'conflict').length,
        ops,
      }
    },
    [],
    { total: 0, pending: 0, failed: 0, ops: [] },
  )
}

export function useAiQueue() {
  return useLiveQuery(
    async () => {
      const jobs = await db.aiQueue.orderBy('createdAt').toArray()
      return {
        jobs,
        queued: jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
        failed: jobs.filter((job) => job.status === 'failed').length,
      }
    },
    [],
    { jobs: [], queued: 0, failed: 0 },
  )
}

export function useConflicts() {
  return useLiveQuery(
    async () => {
      const rows = await db.conflicts.orderBy('detectedAt').reverse().toArray()
      return rows
    },
    [],
    [],
  )
}

export function useAuditLog(limit = 100) {
  return useLiveQuery(
    async () => db.audit.orderBy('timestamp').reverse().limit(limit).toArray(),
    [limit],
    [],
  )
}

export function usePatientStats(patients: Patient[]) {
  return useMemo(() => {
    const stats = { red: 0, yellow: 0, green: 0, unmonitored: 0, total: patients.length }
    for (const patient of patients) stats[patient.riskScore] += 1
    return stats
  }, [patients])
}
