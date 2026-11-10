/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express'
import crypto from 'crypto'
import { extractSignal } from '../../services/ai'
import type { AuthRequest } from '../../middleware/auth'
import {
  countPatientRows,
  enqueueOutbound,
  getDoctorById,
  getPatientRow,
  insertPatientRow,
  listAlertRows,
  listCheckInRows,
  listNoteRows,
  listPatientRows,
  recordAudit,
  updatePatientData,
} from '../repo'
import { normalizeSignal, toAlertDTO, toCheckInDTO, toNoteDTO, toPatientDTO } from '../dto'

const VALID_RISKS = ['red', 'yellow', 'green', 'unmonitored'] as const
const VALID_LANGUAGES = ['english', 'pidgin', 'yoruba', 'igbo', 'hausa'] as const

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function asRisk(value: unknown, fallback = 'green'): string {
  return VALID_RISKS.includes(value as (typeof VALID_RISKS)[number]) ? String(value) : fallback
}

function provenanceFrom(payload: any, fallbackSource: 'gemini' | 'clinician' | 'offline-rule' = 'clinician') {
  const provenance = payload?.provenance
  if (provenance && typeof provenance === 'object') {
    const validSources = ['gemini', 'offline-rule', 'clinician', 'server-fallback']
    const source = validSources.includes(provenance.source) ? provenance.source : fallbackSource
    return {
      model: asString(provenance.model, source === 'clinician' ? 'clinician' : 'gemini-2.5-flash'),
      promptVersion: asString(
        provenance.promptVersion,
        source === 'clinician' ? 'clinician-review@1.0.0' : 'unknown@0.0.0',
      ),
      generatedAt: provenance.generatedAt ?? new Date().toISOString(),
      source,
      confidence: typeof provenance.confidence === 'number' ? provenance.confidence : 0,
    }
  }
  return {
    model: fallbackSource === 'clinician' ? 'clinician' : 'gemini-2.5-flash',
    promptVersion: fallbackSource === 'clinician' ? 'clinician-review@1.0.0' : 'unknown@0.0.0',
    generatedAt: new Date().toISOString(),
    source: fallbackSource,
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
  }
}

export async function listPatients(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const page = Math.max(1, Number(req.query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
  const riskScore = typeof req.query.riskScore === 'string' ? req.query.riskScore : undefined
  const search = typeof req.query.search === 'string' ? req.query.search : undefined

  const [patients, total] = await Promise.all([
    listPatientRows(doctorId, { riskScore, search, page, limit }),
    countPatientRows(doctorId, { riskScore, search }),
  ])

  res.json({
    patients: patients.map((patient) => toPatientDTO(patient)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const [checkIns, alerts, notes] = await Promise.all([
    listCheckInRows(patient.id, 100),
    listAlertRows(doctorId),
    listNoteRows(doctorId, patient.id, 100),
  ])

  res.json(
    toPatientDTO(patient, {
      signal: normalizeSignal(patient.data?.signal),
      checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, patient.client_id)),
      alerts: alerts
        .filter((alert) => alert.patient_id === patient.id)
        .map((alert) => toAlertDTO(alert, patient.client_id)),
      notes: notes.map((note) => toNoteDTO(note, patient.client_id)),
    }),
  )
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const { name, phoneNumber, language, age } = req.body as {
    name?: string
    phoneNumber?: string
    language?: string
    age?: number
  }

  if (!name || name.trim().length < 2) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Name must be at least 2 characters' } })
    return
  }
  if (!phoneNumber || !/^\+?\d{10,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Phone number must contain 10-15 digits' },
    })
    return
  }
  if (!language || !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: `Language must be one of: ${VALID_LANGUAGES.join(', ')}` },
    })
    return
  }

  const doctor = await getDoctorById(doctorId)
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Doctor not found' } })
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  const clientId = crypto.randomUUID()
  const patient = await insertPatientRow(doctorId, doctor.hospital_id, clientId, {
    name: name.trim(),
    phoneNumber: phoneNumber.replace(/\s/g, ''),
    language,
    age: typeof age === 'number' && age > 0 ? age : 0,
    diagnosis: 'Awaiting Signal',
    admittedDate: today,
    dischargedDate: today,
    checkInToken: crypto.randomBytes(20).toString('hex'),
    riskScore: 'unmonitored',
    lastCheckIn: null,
    signal: null,
  })

  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'patient.created',
    entityType: 'patient',
    entityId: patient.client_id,
    summary: `Registered patient ${name.trim()}`,
    detail: { phoneNumber: phoneNumber.replace(/\s/g, ''), language },
  })

  res.status(201).json(toPatientDTO(patient))
}

export async function generateSignal(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const { rawNotes } = req.body as { rawNotes?: string }
  if (!rawNotes || rawNotes.length < 50) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Raw notes must be at least 50 characters' },
    })
    return
  }

  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  try {
    const extracted = await extractSignal(rawNotes)
    res.json({ ...extracted, rawNotes, approvedAt: null })
  } catch (error) {
    console.error('[AI] Signal extraction failed:', error)
    res.status(502).json({
      error: {
        code: 'AI_SERVICE_ERROR',
        message: 'Failed to extract signal from notes. The request will be retried by the offline queue.',
      },
    })
  }
}

export async function approveSignal(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const signal = req.body?.signal as Record<string, any> | undefined
  if (!signal) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Signal data is required' } })
    return
  }

  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const provenance = provenanceFrom(signal, 'clinician')
  const nextSignal = {
    patientSummary: asString(signal.patientSummary),
    rawNotes: asString(signal.rawNotes, patient.data?.signal?.rawNotes ?? ''),
    diagnosis: asString(signal.diagnosis, patient.data?.diagnosis ?? ''),
    medications: Array.isArray(signal.medications)
      ? signal.medications.map((med: any) => ({
          name: asString(med?.name, 'Unknown medication'),
          dose: asString(med?.dose, '—'),
          frequency: asString(med?.frequency, '—'),
          status: ['continued', 'started', 'stopped', 'adjusted'].includes(med?.status)
            ? med.status
            : 'continued',
          confidence: typeof med?.confidence === 'number' ? med.confidence : 0,
        }))
      : [],
    redFlags: asStringArray(signal.redFlags),
    monitoringSchedule: Array.isArray(signal.monitoringSchedule)
      ? signal.monitoringSchedule.map((item: any) => ({
          question: asString(item?.question),
          frequency: ['daily', 'weekly', 'as_needed'].includes(item?.frequency)
            ? item.frequency
            : 'daily',
          time: typeof item?.time === 'string' && item.time ? item.time : null,
        }))
      : [],
    confidence: typeof signal.confidence === 'number' ? signal.confidence : 0,
    approvedAt: new Date().toISOString(),
    approvedBy: doctorId,
    provenance,
  }

  const nextData = {
    ...(patient.data ?? {}),
    signal: nextSignal,
    diagnosis: asString(signal.diagnosis, patient.data?.diagnosis ?? ''),
    age: typeof signal.age === 'number' && signal.age > 0 ? signal.age : patient.data?.age ?? 0,
    riskScore: 'green',
  }
  const updated = await updatePatientData(patient.id, nextData)

  const doctor = await getDoctorById(doctorId)
  const hospitalName = doctor?.hospital_name ?? 'your hospital'
  await enqueueOutbound({
    idempotencyKey: `welcome:${patient.client_id}:${updated?.server_version ?? patient.server_version + 1}`,
    doctorId,
    patientId: patient.id,
    phoneNumber: patient.data?.phoneNumber ?? '',
    body: `Hello ${patient.data?.name ?? 'there'}, this is Toju, your health partner from ${hospitalName}. ${
      doctor?.name ?? 'Your doctor'
    } has asked me to help you recover at home. Can we start our daily check-ins? (Reply YES)`,
    kind: 'welcome',
    priority: 60,
  })

  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'signal.approved',
    entityType: 'patient',
    entityId: patient.client_id,
    summary: `Approved care signal for ${patient.data?.name ?? 'patient'}`,
    promptVersion: provenance.promptVersion,
    model: provenance.model,
    detail: {
      redFlags: nextSignal.redFlags,
      medicationCount: nextSignal.medications.length,
      monitoringCount: nextSignal.monitoringSchedule.length,
    },
  })

  res.json({ patient: updated ? toPatientDTO(updated) : toPatientDTO(patient), dispatched: false })
}

export async function updateRiskScore(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const riskScore = asRisk(req.body?.riskScore, 'unmonitored')
  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const previous = patient.data?.riskScore
  const updated = await updatePatientData(patient.id, { ...(patient.data ?? {}), riskScore })
  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'patient.risk_changed',
    entityType: 'patient',
    entityId: patient.client_id,
    summary: `Risk set to ${riskScore}`,
    detail: { previous, next: riskScore },
  })

  res.json({ id: patient.client_id, riskScore: updated?.data?.riskScore ?? riskScore })
}
