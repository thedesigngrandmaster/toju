/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express'
import crypto from 'crypto'
import { env } from '../../config/env'
import type { AuthRequest } from '../../middleware/auth'
import { query } from '../db'
import {
  enqueueOutbound,
  getAlertRow,
  getDoctorById,
  getNoteByClientId,
  getPatientByClientId,
  getPatientRow,
  getSyncOperation,
  insertPatientRow,
  insertSyncOperation,
  listAlertRows,
  listCheckInRows,
  listNoteRows,
  recomputePatientRisk,
  recordAudit,
  updateAlertData,
  updatePatientData,
  upsertAlert,
  upsertCheckIn,
  upsertNote,
} from '../repo'
import type { AlertRow, CheckInRow, NoteRow, PatientRow } from '../dto'
import { normalizeSignal, toAlertDTO, toCheckInDTO, toNoteDTO, toPatientDTO } from '../dto'

class SyncRejectError extends Error {}

interface PushOperation {
  id: string
  entityType: string
  entityId: string
  op: string
  payload: Record<string, any>
  baseVersion?: number
  clientTimestamp?: string
}

interface OperationResult {
  status: 'applied' | 'conflict'
  serverVersion?: number
  conflictResolved?: boolean
  patient?: Record<string, unknown>
  alert?: Record<string, unknown>
  note?: Record<string, unknown>
  checkIn?: Record<string, unknown>
}

const VALID_RISKS = ['red', 'yellow', 'green', 'unmonitored']
const VALID_LANGUAGES = ['english', 'pidgin', 'yoruba', 'igbo', 'hausa']

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function asDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(String(value ?? ''))
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function asIso(value: unknown, fallback = new Date()): string {
  return asDate(value, fallback).toISOString()
}

function asRisk(value: unknown, fallback = 'green'): string {
  return VALID_RISKS.includes(String(value)) ? String(value) : fallback
}

function rank(risk: string): number {
  return risk === 'red' ? 3 : risk === 'yellow' ? 2 : risk === 'green' ? 1 : 0
}

function conflictStatus(baseVersion: number | undefined, serverVersion: number): 'applied' | 'conflict' {
  if (typeof baseVersion === 'number' && baseVersion > 0 && baseVersion < serverVersion) return 'conflict'
  return 'applied'
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

function requirePatient(patient: PatientRow | null): PatientRow {
  if (!patient) throw new SyncRejectError('Patient not found for this clinician')
  return patient
}

async function applyOperation(
  req: AuthRequest,
  deviceId: string,
  operation: PushOperation,
): Promise<OperationResult> {
  const doctorId = req.doctorId as string
  const payload = operation.payload ?? {}

  switch (operation.op) {
    case 'patient.create': {
      const doctor = await getDoctorById(doctorId)
      if (!doctor) throw new SyncRejectError('Doctor not found')

      const existing = await getPatientByClientId(doctorId, operation.entityId)
      if (existing) {
        return { status: 'applied', serverVersion: existing.server_version, patient: toPatientDTO(existing) }
      }

      const name = asString(payload.name).trim()
      const phoneNumber = asString(payload.phoneNumber).trim()
      const language = asString(payload.language, 'english')
      if (name.length < 2) throw new SyncRejectError('Patient name must be at least 2 characters')
      if (!/^\+?\d{10,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
        throw new SyncRejectError('Phone number must contain 10-15 digits')
      }
      if (!VALID_LANGUAGES.includes(language)) throw new SyncRejectError('Unsupported language')

      const now = new Date().toISOString()
      const patient = await insertPatientRow(doctorId, doctor.hospital_id, operation.entityId, {
        name,
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        language,
        age: typeof payload.age === 'number' && payload.age > 0 ? payload.age : 0,
        diagnosis: 'Awaiting Signal',
        admittedDate: now.slice(0, 10),
        dischargedDate: now.slice(0, 10),
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
        summary: `Registered patient ${name}`,
        deviceId,
        detail: { phoneNumber: patient.data?.phoneNumber, language },
      })

      return { status: 'applied', serverVersion: patient.server_version, patient: toPatientDTO(patient) }
    }

    case 'patient.update': {
      const patient = requirePatient(await getPatientRow(doctorId, operation.entityId))
      const status = conflictStatus(operation.baseVersion, patient.server_version)
      const data = { ...(patient.data ?? {}) }
      if (typeof payload.name === 'string' && payload.name.trim().length >= 2) data.name = payload.name.trim()
      if (typeof payload.phoneNumber === 'string' && payload.phoneNumber.trim()) {
        data.phoneNumber = payload.phoneNumber.trim()
      }
      if (typeof payload.age === 'number' && payload.age >= 0) data.age = payload.age
      if (typeof payload.language === 'string' && VALID_LANGUAGES.includes(payload.language)) {
        data.language = payload.language
      }
      if (typeof payload.diagnosis === 'string' && payload.diagnosis.trim()) {
        data.diagnosis = payload.diagnosis.trim()
      }
      const updated = await updatePatientData(patient.id, data)
      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: updated?.server_version ?? patient.server_version + 1,
        patient: toPatientDTO(updated ?? patient),
      }
    }

    case 'patient.risk': {
      const patient = requirePatient(await getPatientRow(doctorId, operation.entityId))
      const nextRisk = asRisk(payload.riskScore, patient.data?.riskScore ?? 'unmonitored')
      const status = conflictStatus(operation.baseVersion, patient.server_version)
      const previous = patient.data?.riskScore
      const updated = await updatePatientData(patient.id, { ...(patient.data ?? {}), riskScore: nextRisk })

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'patient.risk_changed',
        entityType: 'patient',
        entityId: patient.client_id,
        summary: `Risk set to ${nextRisk}`,
        deviceId,
        detail: { previous, next: nextRisk },
      })

      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: updated?.server_version ?? patient.server_version + 1,
        patient: toPatientDTO(updated ?? patient),
      }
    }

    case 'signal.approve': {
      const patient = requirePatient(await getPatientRow(doctorId, operation.entityId))
      const signal = payload.signal
      if (!signal || typeof signal !== 'object') throw new SyncRejectError('Signal payload is required')
      const status = conflictStatus(operation.baseVersion, patient.server_version)
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
        idempotencyKey: `welcome:${operation.id}`,
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
        deviceId,
        detail: {
          redFlags: nextSignal.redFlags,
          medicationCount: nextSignal.medications.length,
          monitoringCount: nextSignal.monitoringSchedule.length,
        },
      })

      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: updated?.server_version ?? patient.server_version + 1,
        patient: toPatientDTO(updated ?? patient),
      }
    }

    case 'alert.resolve': {
      const alert = await getAlertRow(doctorId, operation.entityId)
      if (!alert) throw new SyncRejectError('Alert not found')

      let updatedAlert: AlertRow = alert
      if (!alert.data?.resolved) {
        const updated = await updateAlertData(alert.id, {
          ...(alert.data ?? {}),
          resolved: true,
          resolvedAt: asIso(payload.resolvedAt),
        })
        if (updated) updatedAlert = updated
        if (alert.patient_id) await recomputePatientRisk(alert.patient_id)
      }

      const patient = alert.patient_id
        ? await query<PatientRow>(`SELECT * FROM patients WHERE id = $1 LIMIT 1`, [alert.patient_id]).then(
            (rows) => rows[0] ?? null,
          )
        : null

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'alert.resolved',
        entityType: 'alert',
        entityId: alert.client_id,
        summary: `Resolved alert for ${patient?.data?.name ?? 'patient'}`,
        deviceId,
        detail: { type: alert.data?.type, message: alert.data?.message },
      })

      return {
        status: 'applied',
        serverVersion: updatedAlert.server_version,
        alert: toAlertDTO(updatedAlert, patient?.client_id),
        patient: patient ? toPatientDTO(patient) : undefined,
      }
    }

    case 'note.create': {
      const patientClientId = asString(payload.patientId)
      const patient = patientClientId
        ? requirePatient(await getPatientByClientId(doctorId, patientClientId))
        : null
      if (!patient) throw new SyncRejectError('A note requires a valid patientId')

      const existing = await getNoteByClientId(doctorId, operation.entityId)
      const note = await upsertNote(doctorId, patient.id, operation.entityId, {
        body: asString(payload.body, existing?.data?.body ?? ''),
        authorId: asString(payload.authorId, doctorId),
        authorName: asString(payload.authorName, existing?.data?.authorName ?? 'Clinician'),
        createdAt: asString(payload.createdAt, existing?.data?.createdAt ?? new Date().toISOString()),
      })

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'note.created',
        entityType: 'note',
        entityId: note.client_id,
        summary: `Added clinical note for ${patient.data?.name ?? 'patient'}`,
        deviceId,
        detail: { patientId: patient.client_id, length: asString(note.data?.body).length },
      })

      return { status: 'applied', note: toNoteDTO(note, patient.client_id) }
    }

    case 'checkin.triage': {
      const checkInPayload = payload.checkIn
      if (!checkInPayload || typeof checkInPayload !== 'object') {
        throw new SyncRejectError('checkIn payload is required')
      }
      const patientClientId = asString(checkInPayload.patientId)
      const patient = requirePatient(await getPatientByClientId(doctorId, patientClientId))
      const riskScore = asRisk(checkInPayload.riskScore)
      const timestamp = asIso(checkInPayload.timestamp)
      const clientId = asString(checkInPayload.id, operation.entityId)
      const provenance = provenanceFrom(checkInPayload, 'offline-rule')

      const checkIn = await upsertCheckIn(doctorId, patient.id, clientId, {
        timestamp,
        message: asString(checkInPayload.message),
        riskScore,
        triggeredFlags: asStringArray(checkInPayload.triggeredFlags),
        botResponse: asString(checkInPayload.botResponse),
        aiStatus: ['idle', 'queued', 'processing', 'ready', 'error'].includes(checkInPayload.aiStatus)
          ? checkInPayload.aiStatus
          : 'ready',
        provenance,
        source: 'sync',
      })

      let alertDTO: Record<string, unknown> | undefined
      const alertPayload = payload.alert
      if (alertPayload && typeof alertPayload === 'object') {
        const alertClientId = asString(alertPayload.id, crypto.randomUUID())
        const alert = await upsertAlert(doctorId, patient.id, alertClientId, {
          timestamp: asIso(alertPayload.timestamp, new Date(timestamp)),
          type: alertPayload.type === 'missed_checkin' ? 'missed_checkin' : 'red_flag',
          message: asString(alertPayload.message, 'Red flag alert'),
          resolved: Boolean(alertPayload.resolved),
          resolvedAt: alertPayload.resolved ? asIso(alertPayload.resolvedAt) : null,
          severity: alertPayload.severity === 'warning' ? 'warning' : 'critical',
        })
        alertDTO = toAlertDTO(alert, patient.client_id)
      }

      const nextRisk =
        rank(riskScore) >= rank(String(patient.data?.riskScore ?? 'unmonitored'))
          ? riskScore
          : String(patient.data?.riskScore ?? 'unmonitored')
      const updatedPatient = await updatePatientData(patient.id, {
        ...(patient.data ?? {}),
        riskScore: nextRisk,
        lastCheckIn: timestamp,
      })

      await recordAudit({
        doctorId,
        actor: 'ai',
        action: 'triage.completed',
        entityType: 'checkin',
        entityId: clientId,
        summary: `Triage classified a patient message as ${riskScore.toUpperCase()}`,
        promptVersion: provenance.promptVersion,
        model: provenance.model,
        deviceId,
        detail: {
          patientId: patient.client_id,
          riskScore,
          triggeredFlags: asStringArray(checkInPayload.triggeredFlags),
          source: provenance.source,
        },
      })

      return {
        status: 'applied',
        checkIn: toCheckInDTO(checkIn, patient.client_id),
        alert: alertDTO,
        patient: updatedPatient ? toPatientDTO(updatedPatient) : undefined,
      }
    }

    case 'whatsapp.send': {
      const phoneNumber = asString(payload.phoneNumber).trim()
      const body = asString(payload.body).trim()
      if (!phoneNumber || !body) throw new SyncRejectError('Phone number and message body are required')

      const patientClientId = asString(payload.patientId)
      const patient = patientClientId ? await getPatientByClientId(doctorId, patientClientId) : null

      await enqueueOutbound({
        idempotencyKey: operation.id,
        doctorId,
        patientId: patient?.id ?? null,
        phoneNumber,
        body,
        kind: 'manual',
        priority: 35,
      })

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'whatsapp.message_queued',
        entityType: 'whatsapp',
        entityId: operation.id,
        summary: `Queued WhatsApp message to ${patient?.data?.name ?? phoneNumber}`,
        deviceId,
        detail: { phoneNumber, length: body.length },
      })

      return { status: 'applied' }
    }

    default:
      throw new SyncRejectError(`Unsupported operation: ${operation.op}`)
  }
}

export async function push(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const body = (req.body ?? {}) as { deviceId?: string; operations?: PushOperation[] }
  const deviceId = asString(body.deviceId, 'unknown')
  const operations = Array.isArray(body.operations) ? body.operations : null

  if (!operations) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'operations must be an array' } })
    return
  }

  const results: Array<Record<string, unknown>> = []

  for (const operation of operations) {
    if (!operation?.id || !operation.op || !operation.entityId) {
      results.push({ id: operation?.id ?? 'unknown', status: 'rejected', error: 'Malformed operation' })
      continue
    }

    try {
      const previous = await getSyncOperation(doctorId, operation.id)
      if (previous) {
        results.push({ id: operation.id, ...(previous.result ?? {}), status: 'duplicate' })
        continue
      }

      const result = await applyOperation(req, deviceId, operation)
      await insertSyncOperation({
        operationId: operation.id,
        doctorId,
        deviceId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        op: operation.op,
        status: result.status,
        result,
      })

      results.push({ id: operation.id, ...result })
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Operation failed'
      if (error instanceof SyncRejectError) {
        const result = { status: 'rejected', error: messageText }
        await insertSyncOperation({
          operationId: operation.id,
          doctorId,
          deviceId,
          entityType: operation.entityType,
          entityId: operation.entityId,
          op: operation.op,
          status: 'rejected',
          result,
          error: messageText,
        })
        results.push({ id: operation.id, ...result })
      } else {
        console.error('[SYNC] Transient operation failure:', operation.op, messageText)
        results.push({ id: operation.id, status: 'retry', error: messageText })
      }
    }
  }

  res.json({ results, serverTime: new Date().toISOString() })
}

export async function pull(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const rawSince = typeof req.query.since === 'string' ? req.query.since : ''
  const parsedSince = rawSince ? new Date(rawSince) : new Date(0)
  const since = Number.isNaN(parsedSince.getTime()) ? new Date(0) : parsedSince
  const upperBound = new Date()
  const limit = env.syncPageSize

  const [patients, alerts, checkIns, notes] = await Promise.all([
    query<PatientRow>(
      `SELECT * FROM patients
        WHERE doctor_id = $1 AND updated_at > $2 AND updated_at <= $3
        ORDER BY updated_at ASC LIMIT $4`,
      [doctorId, since, upperBound, limit],
    ),
    query<AlertRow>(
      `SELECT a.*, p.client_id AS patient_client_id
         FROM alerts a
         LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = $1 AND a.updated_at > $2 AND a.updated_at <= $3
        ORDER BY a.updated_at ASC LIMIT $4`,
      [doctorId, since, upperBound, limit],
    ),
    query<CheckInRow>(
      `SELECT c.*, p.client_id AS patient_client_id
         FROM check_ins c
         LEFT JOIN patients p ON p.id = c.patient_id
        WHERE c.doctor_id = $1 AND c.updated_at > $2 AND c.updated_at <= $3
        ORDER BY c.updated_at ASC LIMIT $4`,
      [doctorId, since, upperBound, limit],
    ),
    query<NoteRow>(
      `SELECT n.*, p.client_id AS patient_client_id
         FROM notes n
         LEFT JOIN patients p ON p.id = n.patient_id
        WHERE n.doctor_id = $1 AND n.updated_at > $2 AND n.updated_at <= $3
        ORDER BY n.updated_at ASC LIMIT $4`,
      [doctorId, since, upperBound, limit],
    ),
  ])

  res.json({
    serverTime: upperBound.toISOString(),
    patients: patients.map((patient) =>
      toPatientDTO(patient, {
        checkIns: [],
        alerts: [],
        notes: [],
        signal: normalizeSignal(patient.data?.signal),
      }),
    ),
    alerts: alerts.map((alert) => toAlertDTO(alert, alert.patient_client_id)),
    checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, checkIn.patient_client_id)),
    notes: notes.map((note) => toNoteDTO(note, note.patient_client_id)),
    hasMore:
      patients.length >= limit ||
      alerts.length >= limit ||
      checkIns.length >= limit ||
      notes.length >= limit,
  })
}
