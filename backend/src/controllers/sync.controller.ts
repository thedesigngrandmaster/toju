import { Response } from 'express'
import crypto from 'crypto'
import { Types } from 'mongoose'
import { Patient, type RiskScore } from '../models/Patient'
import { Alert } from '../models/Alert'
import { CheckIn } from '../models/CheckIn'
import { Note } from '../models/Note'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { SyncOperation } from '../models/SyncOperation'
import { env } from '../config/env'
import type { AuthRequest } from '../middleware/auth'
import { recordAudit } from '../services/audit'
import { enqueueOutboundMessage } from '../services/outbound'
import { recomputePatientRisk } from '../services/risk'
import {
  findAlertForDoctor,
  findPatientForDoctor,
  idQuery,
  normalizeSignal,
  patientClientIdMap,
  toAlertDTO,
  toCheckInDTO,
  toNoteDTO,
  toPatientDTO,
} from '../services/serializers'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const VALID_RISKS: RiskScore[] = ['red', 'yellow', 'green', 'unmonitored']
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

function asRisk(value: unknown, fallback: RiskScore = 'green'): RiskScore {
  return VALID_RISKS.includes(value as RiskScore) ? (value as RiskScore) : fallback
}

function rank(risk: RiskScore): number {
  return risk === 'red' ? 3 : risk === 'yellow' ? 2 : risk === 'green' ? 1 : 0
}

function conflictStatus(baseVersion: number | undefined, serverVersion: number): 'applied' | 'conflict' {
  if (typeof baseVersion === 'number' && baseVersion > 0 && baseVersion < serverVersion) return 'conflict'
  return 'applied'
}

function requirePatient(doctorId: string, id: string): Promise<any> {
  return findPatientForDoctor(doctorId, id).then((patient) => {
    if (!patient) throw new SyncRejectError('Patient not found for this clinician')
    return patient
  })
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
        source === 'clinician' ? 'clinician-review@1.0.0' : 'unknown@0.0.0'
      ),
      generatedAt: asDate(provenance.generatedAt),
      source,
      confidence: typeof provenance.confidence === 'number' ? provenance.confidence : 0,
    }
  }
  return {
    model: fallbackSource === 'clinician' ? 'clinician' : 'gemini-2.5-flash',
    promptVersion: fallbackSource === 'clinician' ? 'clinician-review@1.0.0' : 'unknown@0.0.0',
    generatedAt: new Date(),
    source: fallbackSource,
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
  }
}

async function applyOperation(req: AuthRequest, deviceId: string, operation: PushOperation): Promise<OperationResult> {
  const doctorId = req.doctorId as string
  const payload = operation.payload ?? {}

  switch (operation.op) {
    case 'patient.create': {
      const doctor = await Doctor.findById(doctorId).lean()
      if (!doctor) throw new SyncRejectError('Doctor not found')

      const existing = await Patient.findOne({ doctorId, clientId: operation.entityId })
      if (existing) {
        return {
          status: 'applied',
          serverVersion: existing.serverVersion,
          patient: toPatientDTO(existing.toObject()),
        }
      }

      const name = asString(payload.name).trim()
      const phoneNumber = asString(payload.phoneNumber).trim()
      const language = asString(payload.language, 'english')
      if (name.length < 2) throw new SyncRejectError('Patient name must be at least 2 characters')
      if (!/^\+?\d{10,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
        throw new SyncRejectError('Phone number must contain 10-15 digits')
      }
      if (!VALID_LANGUAGES.includes(language)) throw new SyncRejectError('Unsupported language')

      const now = new Date()
      const patient = await Patient.create({
        clientId: operation.entityId,
        doctorId,
        hospitalId: doctor.hospitalId,
        name,
        age: typeof payload.age === 'number' && payload.age > 0 ? payload.age : 0,
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        language,
        diagnosis: 'Awaiting Signal',
        admittedDate: now,
        dischargedDate: now,
        riskScore: 'unmonitored',
        checkInToken: crypto.randomBytes(20).toString('hex'),
        serverVersion: 1,
      })

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'patient.created',
        entityType: 'patient',
        entityId: patient.clientId,
        summary: `Registered patient ${patient.name}`,
        deviceId,
        detail: { phoneNumber: patient.phoneNumber, language },
      })

      return { status: 'applied', serverVersion: patient.serverVersion, patient: toPatientDTO(patient.toObject()) }
    }

    case 'patient.update': {
      const patient = await Patient.findOne({ doctorId, ...idQuery(operation.entityId) })
      if (!patient) throw new SyncRejectError('Patient not found')
      const status = conflictStatus(operation.baseVersion, patient.serverVersion)

      if (typeof payload.name === 'string' && payload.name.trim().length >= 2) patient.name = payload.name.trim()
      if (typeof payload.phoneNumber === 'string' && payload.phoneNumber.trim()) {
        patient.phoneNumber = payload.phoneNumber.trim()
      }
      if (typeof payload.age === 'number' && payload.age >= 0) patient.age = payload.age
      if (typeof payload.language === 'string' && VALID_LANGUAGES.includes(payload.language)) {
        patient.language = payload.language as any
      }
      if (typeof payload.diagnosis === 'string' && payload.diagnosis.trim()) {
        patient.diagnosis = payload.diagnosis.trim()
      }
      patient.serverVersion += 1
      await patient.save()

      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: patient.serverVersion,
        patient: toPatientDTO(patient.toObject()),
      }
    }

    case 'patient.risk': {
      const patient = await Patient.findOne({ doctorId, ...idQuery(operation.entityId) })
      if (!patient) throw new SyncRejectError('Patient not found')
      const nextRisk = asRisk(payload.riskScore, patient.riskScore)
      const status = conflictStatus(operation.baseVersion, patient.serverVersion)
      const previous = patient.riskScore

      patient.riskScore = nextRisk
      patient.serverVersion += 1
      await patient.save()

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'patient.risk_changed',
        entityType: 'patient',
        entityId: patient.clientId,
        summary: `Risk set to ${nextRisk}`,
        deviceId,
        detail: { previous, next: nextRisk },
      })

      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: patient.serverVersion,
        patient: toPatientDTO(patient.toObject()),
      }
    }

    case 'signal.approve': {
      const patient = await Patient.findOne({ doctorId, ...idQuery(operation.entityId) })
      if (!patient) throw new SyncRejectError('Patient not found')
      const signal = payload.signal
      if (!signal || typeof signal !== 'object') throw new SyncRejectError('Signal payload is required')
      const status = conflictStatus(operation.baseVersion, patient.serverVersion)
      const provenance = provenanceFrom(signal, 'clinician')

      patient.signal = {
        patientSummary: asString(signal.patientSummary),
        rawNotes: asString(signal.rawNotes, patient.signal?.rawNotes ?? ''),
        diagnosis: asString(signal.diagnosis, patient.diagnosis),
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
        approvedAt: new Date(),
        approvedBy: doctorId,
        provenance,
      }
      patient.diagnosis = asString(signal.diagnosis, patient.diagnosis)
      if (typeof signal.age === 'number' && signal.age > 0) patient.age = signal.age
      patient.riskScore = 'green'
      patient.serverVersion += 1
      await patient.save()

      const doctor = await Doctor.findById(doctorId).lean()
      const hospital = doctor ? await Hospital.findById(doctor.hospitalId).lean() : null
      const hospitalName = hospital?.name ?? 'your hospital'
      await enqueueOutboundMessage({
        idempotencyKey: `welcome:${operation.id}`,
        doctorId,
        patientId: patient._id,
        phoneNumber: patient.phoneNumber,
        body: `Hello ${patient.name}, this is Toju, your health partner from ${hospitalName}. ${
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
        entityId: patient.clientId,
        summary: `Approved care signal for ${patient.name}`,
        promptVersion: provenance.promptVersion,
        model: provenance.model,
        deviceId,
        detail: {
          redFlags: patient.signal.redFlags,
          medicationCount: patient.signal.medications.length,
          monitoringCount: patient.signal.monitoringSchedule.length,
        },
      })

      return {
        status,
        conflictResolved: status === 'conflict',
        serverVersion: patient.serverVersion,
        patient: toPatientDTO(patient.toObject()),
      }
    }

    case 'alert.resolve': {
      const alert = await Alert.findOne({ doctorId, ...idQuery(operation.entityId) })
      if (!alert) throw new SyncRejectError('Alert not found')

      if (!alert.resolved) {
        alert.resolved = true
        alert.resolvedAt = asDate(payload.resolvedAt)
        alert.serverVersion += 1
        await alert.save()
        await recomputePatientRisk(String(alert.patientId))
      }

      const patient = await Patient.findById(alert.patientId).lean()
      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'alert.resolved',
        entityType: 'alert',
        entityId: alert.clientId,
        summary: `Resolved alert for ${patient?.name ?? 'patient'}`,
        deviceId,
        detail: { type: alert.type, message: alert.message },
      })

      return {
        status: 'applied',
        serverVersion: alert.serverVersion,
        alert: toAlertDTO(alert.toObject(), patient?.clientId),
        patient: patient ? toPatientDTO(patient) : undefined,
      }
    }

    case 'note.create': {
      const patientClientId = asString(payload.patientId)
      const patient = patientClientId
        ? await requirePatient(doctorId, patientClientId)
        : null
      if (!patient) throw new SyncRejectError('A note requires a valid patientId')

      const existing = await Note.findOne({ doctorId, clientId: operation.entityId })
      const note = existing
        ? await Note.findByIdAndUpdate(
            existing._id,
            {
              $set: {
                body: asString(payload.body, existing.body),
                authorName: asString(payload.authorName, existing.authorName),
              },
            },
            { new: true }
          )
        : await Note.create({
            clientId: operation.entityId,
            patientId: patient._id,
            doctorId,
            authorId: asString(payload.authorId, doctorId),
            authorName: asString(payload.authorName, 'Clinician'),
            body: asString(payload.body),
            createdAt: asDate(payload.createdAt),
            updatedAt: asDate(payload.createdAt),
          })

      if (!note) throw new SyncRejectError('Note write failed')

      await recordAudit({
        doctorId,
        actor: 'clinician',
        action: 'note.created',
        entityType: 'note',
        entityId: note.clientId,
        summary: `Added clinical note for ${patient.name}`,
        deviceId,
        detail: { patientId: patient.clientId, length: note.body.length },
      })

      return {
        status: 'applied',
        note: toNoteDTO(note.toObject(), patient.clientId),
      }
    }

    case 'checkin.triage': {
      const checkInPayload = payload.checkIn
      if (!checkInPayload || typeof checkInPayload !== 'object') {
        throw new SyncRejectError('checkIn payload is required')
      }
      const patientClientId = asString(checkInPayload.patientId)
      const patient = await requirePatient(doctorId, patientClientId)
      const riskScore = asRisk(checkInPayload.riskScore)
      const timestamp = asDate(checkInPayload.timestamp)
      const clientId = asString(checkInPayload.id, operation.entityId)
      const provenance = provenanceFrom(checkInPayload, 'offline-rule')

      const checkIn = await CheckIn.findOneAndUpdate(
        { doctorId, clientId },
        {
          $set: {
            patientId: patient._id,
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
          },
          $setOnInsert: { clientId, doctorId },
          $inc: { serverVersion: 1 },
        },
        { upsert: true, new: true }
      )

      let alertDTO: Record<string, unknown> | undefined
      const alertPayload = payload.alert
      if (alertPayload && typeof alertPayload === 'object') {
        const alertClientId = asString(alertPayload.id, crypto.randomUUID())
        const alert = await Alert.findOneAndUpdate(
          { doctorId, clientId: alertClientId },
          {
            $set: {
              patientId: patient._id,
              timestamp: asDate(alertPayload.timestamp, timestamp),
              type: alertPayload.type === 'missed_checkin' ? 'missed_checkin' : 'red_flag',
              message: asString(alertPayload.message, 'Red flag alert'),
              resolved: Boolean(alertPayload.resolved),
              resolvedAt: alertPayload.resolved ? asDate(alertPayload.resolvedAt) : null,
              severity: alertPayload.severity === 'warning' ? 'warning' : 'critical',
            },
            $setOnInsert: { clientId: alertClientId, doctorId },
            $inc: { serverVersion: 1 },
          },
          { upsert: true, new: true }
        )
        alertDTO = toAlertDTO(alert.toObject(), patient.clientId)
      }

      const nextRisk =
        rank(riskScore) >= rank(patient.riskScore as RiskScore) ? riskScore : (patient.riskScore as RiskScore)
      await Patient.updateOne(
        { _id: patient._id },
        {
          $set: {
            riskScore: nextRisk,
            lastCheckIn: timestamp,
          },
          $inc: { serverVersion: 1 },
        }
      )

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
          patientId: patient.clientId,
          riskScore,
          triggeredFlags: asStringArray(checkInPayload.triggeredFlags),
          source: provenance.source,
        },
      })

      const updatedPatient = await Patient.findById(patient._id).lean()
      return {
        status: 'applied',
        checkIn: checkIn ? toCheckInDTO(checkIn.toObject(), patient.clientId) : undefined,
        alert: alertDTO,
        patient: updatedPatient ? toPatientDTO(updatedPatient) : undefined,
      }
    }

    case 'whatsapp.send': {
      const phoneNumber = asString(payload.phoneNumber).trim()
      const body = asString(payload.body).trim()
      if (!phoneNumber || !body) throw new SyncRejectError('Phone number and message body are required')

      const patientClientId = asString(payload.patientId)
      const patient = patientClientId ? await findPatientForDoctor(doctorId, patientClientId) : null

      await enqueueOutboundMessage({
        idempotencyKey: operation.id,
        doctorId,
        patientId: patient?._id ?? null,
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
        summary: `Queued WhatsApp message to ${patient?.name ?? phoneNumber}`,
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
      const previous = await SyncOperation.findOne({
        doctorId,
        operationId: operation.id,
      }).lean()
      if (previous) {
        results.push({ id: operation.id, ...previous.result, status: 'duplicate' })
        continue
      }

      const result = await applyOperation(req, deviceId, operation)
      const ledger = {
        operationId: operation.id,
        doctorId,
        deviceId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        op: operation.op,
        status: result.status,
        result,
        appliedAt: new Date(),
      }

      try {
        await SyncOperation.create(ledger)
      } catch (error: any) {
        // A concurrent retry may have claimed the same operation id first.
        if (error?.code !== 11000) throw error
      }

      results.push({ id: operation.id, ...result })
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Operation failed'
      if (error instanceof SyncRejectError) {
        const result = { status: 'rejected', error: messageText }
        await SyncOperation.create({
          operationId: operation.id,
          doctorId,
          deviceId,
          entityType: operation.entityType,
          entityId: operation.entityId,
          op: operation.op,
          status: 'rejected',
          result,
          error: messageText,
          appliedAt: new Date(),
        }).catch(() => undefined)
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
  const window = { $gt: since, $lte: upperBound }

  const [patients, alerts, checkIns, notes] = await Promise.all([
    Patient.find({ doctorId, updatedAt: window }).sort({ updatedAt: 1 }).limit(limit).lean(),
    Alert.find({ doctorId, updatedAt: window }).sort({ updatedAt: 1 }).limit(limit).lean(),
    CheckIn.find({ doctorId, updatedAt: window }).sort({ updatedAt: 1 }).limit(limit).lean(),
    Note.find({ doctorId, updatedAt: window }).sort({ updatedAt: 1 }).limit(limit).lean(),
  ])

  const patientIds = [
    ...alerts.map((alert) => alert.patientId),
    ...checkIns.map((checkIn) => checkIn.patientId),
    ...notes.map((note) => note.patientId),
  ]
  const clientIdByObjectId = await patientClientIdMap(patientIds)
  const fallbackId = (patientId: unknown) =>
    clientIdByObjectId.get(String(patientId)) ?? String(patientId)

  res.json({
    serverTime: upperBound.toISOString(),
    patients: patients.map((patient) =>
      toPatientDTO(patient, {
        checkIns: [],
        alerts: [],
        notes: [],
        signal: normalizeSignal(patient.signal),
      })
    ),
    alerts: alerts.map((alert) => toAlertDTO(alert, fallbackId(alert.patientId))),
    checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, fallbackId(checkIn.patientId))),
    notes: notes.map((note) => toNoteDTO(note, fallbackId(note.patientId))),
    hasMore:
      patients.length >= limit ||
      alerts.length >= limit ||
      checkIns.length >= limit ||
      notes.length >= limit,
  })
}
