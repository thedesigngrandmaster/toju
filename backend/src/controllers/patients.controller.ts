import { Response } from 'express'
import crypto from 'crypto'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { Note } from '../models/Note'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { extractSignal } from '../services/ai'
import { enqueueOutboundMessage } from '../services/outbound'
import { recordAudit } from '../services/audit'
import {
  findPatientForDoctor,
  idQuery,
  normalizeSignal,
  toAlertDTO,
  toCheckInDTO,
  toNoteDTO,
  toPatientDTO,
} from '../services/serializers'
import type { AuthRequest } from '../middleware/auth'

export async function listPatients(req: AuthRequest, res: Response): Promise<void> {
  const { riskScore, search } = req.query
  const page = Math.max(1, Number(req.query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (riskScore) filter.riskScore = riskScore
  if (search) filter.name = { $regex: search, $options: 'i' }

  const [patients, total] = await Promise.all([
    Patient.find(filter).sort({ riskScore: 1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Patient.countDocuments(filter),
  ])

  const patientIds = patients.map((patient) => patient._id)
  const alertCounts = await Alert.aggregate([
    { $match: { patientId: { $in: patientIds }, resolved: false } },
    { $group: { _id: '$patientId', unresolved: { $sum: 1 } } },
  ])
  const alertMap = new Map(alertCounts.map((item) => [String(item._id), item.unresolved as number]))

  const result = patients.map((patient) => ({
    id: patient.clientId,
    name: patient.name,
    age: patient.age,
    diagnosis: patient.diagnosis,
    admittedDate: patient.admittedDate,
    dischargedDate: patient.dischargedDate,
    doctorId: patient.doctorId,
    riskScore: patient.riskScore,
    phoneNumber: patient.phoneNumber,
    language: patient.language,
    lastCheckIn: patient.lastCheckIn,
    signal: patient.signal
      ? {
          approvedAt: patient.signal.approvedAt,
          confidence: patient.signal.confidence,
          diagnosis: patient.signal.diagnosis,
        }
      : null,
    serverVersion: patient.serverVersion,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    unresolvedAlertCount: alertMap.get(String(patient._id)) ?? 0,
    aiStatus: patient.signal ? (patient.signal.approvedAt ? 'ready' : 'idle') : 'idle',
  }))

  res.json({ patients: result, total, page, totalPages: Math.ceil(total / limit) })
}

export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const patient = await findPatientForDoctor(req.doctorId as string, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const [checkIns, alerts, notes] = await Promise.all([
    CheckIn.find({ patientId: patient._id }).sort({ timestamp: -1 }).limit(100).lean(),
    Alert.find({ patientId: patient._id }).sort({ timestamp: -1 }).lean(),
    Note.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(100).lean(),
  ])

  res.json({
    ...toPatientDTO(patient, {
      signal: normalizeSignal(patient.signal),
      checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, patient.clientId)),
      alerts: alerts.map((alert) => toAlertDTO(alert, patient.clientId)),
      notes: notes.map((note) => toNoteDTO(note, patient.clientId)),
    }),
  })
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
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
  const validLanguages = ['english', 'pidgin', 'yoruba', 'igbo', 'hausa']
  if (!language || !validLanguages.includes(language)) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Language must be one of: ' + validLanguages.join(', ') },
    })
    return
  }

  const doctor = await Doctor.findById(req.doctorId).lean()
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Doctor not found' } })
    return
  }

  const today = new Date()
  const patient = await Patient.create({
    clientId: crypto.randomUUID(),
    name: name.trim(),
    phoneNumber: phoneNumber.replace(/\s/g, ''),
    language,
    doctorId: req.doctorId,
    hospitalId: doctor.hospitalId,
    age: typeof age === 'number' && age > 0 ? age : 0,
    diagnosis: 'Awaiting Signal',
    admittedDate: today,
    dischargedDate: today,
    checkInToken: crypto.randomBytes(20).toString('hex'),
    riskScore: 'unmonitored',
    serverVersion: 1,
  })

  await recordAudit({
    doctorId: req.doctorId as string,
    actor: 'clinician',
    action: 'patient.created',
    entityType: 'patient',
    entityId: patient.clientId,
    summary: `Registered patient ${patient.name}`,
    detail: { phoneNumber: patient.phoneNumber, language },
  })

  res.status(201).json(toPatientDTO(patient.toObject()))
}

export async function generateSignal(req: AuthRequest, res: Response): Promise<void> {
  const { rawNotes } = req.body as { rawNotes?: string }
  if (!rawNotes || rawNotes.length < 50) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Raw notes must be at least 50 characters' },
    })
    return
  }

  const patient = await findPatientForDoctor(req.doctorId as string, req.params.id)
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
  const signal = req.body?.signal as Record<string, unknown> | undefined
  if (!signal) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Signal data is required' } })
    return
  }

  const patient = await Patient.findOne({ doctorId, ...idQuery(req.params.id) })
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const provenance = (signal.provenance as Record<string, unknown> | undefined) ?? {
    model: 'clinician',
    promptVersion: 'clinician-review@1.0.0',
    generatedAt: new Date(),
    source: 'clinician',
    confidence: typeof signal.confidence === 'number' ? signal.confidence : 0,
  }

  patient.signal = {
    patientSummary: typeof signal.patientSummary === 'string' ? signal.patientSummary : '',
    rawNotes: typeof signal.rawNotes === 'string' ? signal.rawNotes : patient.signal?.rawNotes ?? '',
    diagnosis: typeof signal.diagnosis === 'string' ? signal.diagnosis : patient.diagnosis,
    medications: Array.isArray(signal.medications) ? (signal.medications as never[]) : [],
    redFlags: Array.isArray(signal.redFlags) ? (signal.redFlags as string[]) : [],
    monitoringSchedule: Array.isArray(signal.monitoringSchedule)
      ? (signal.monitoringSchedule as never[])
      : [],
    confidence: typeof signal.confidence === 'number' ? signal.confidence : 0,
    approvedAt: new Date(),
    approvedBy: doctorId,
    provenance: provenance as never,
  }
  patient.riskScore = 'green'
  patient.diagnosis = (signal.diagnosis as string) || patient.diagnosis
  if (typeof signal.age === 'number' && signal.age > 0) patient.age = signal.age
  patient.serverVersion += 1
  await patient.save()

  const doctor = await Doctor.findById(doctorId).lean()
  const hospital = doctor ? await Hospital.findById(doctor.hospitalId).lean() : null
  const doctorName = doctor?.name ?? 'your doctor'
  const hospitalName = hospital?.name ?? 'your hospital'

  await enqueueOutboundMessage({
    idempotencyKey: `welcome:${patient.clientId}:${patient.serverVersion}`,
    doctorId,
    patientId: patient._id,
    phoneNumber: patient.phoneNumber,
    body: `Hello ${patient.name}, this is Toju, your health partner from ${hospitalName}. ${doctorName} has asked me to help you recover at home. Can we start our daily check-ins? (Reply YES)`,
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
    promptVersion: typeof provenance.promptVersion === 'string' ? provenance.promptVersion : undefined,
    model: typeof provenance.model === 'string' ? provenance.model : undefined,
    detail: {
      redFlags: patient.signal.redFlags,
      medicationCount: patient.signal.medications.length,
      monitoringCount: patient.signal.monitoringSchedule.length,
    },
  })

  res.json({
    patient: toPatientDTO(patient.toObject()),
    dispatched: false,
    queued: true,
  })
}

export async function updateRiskScore(req: AuthRequest, res: Response): Promise<void> {
  const riskScore = req.body?.riskScore as string | undefined
  const valid = ['red', 'yellow', 'green', 'unmonitored']
  if (!riskScore || !valid.includes(riskScore)) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'riskScore must be one of: ' + valid.join(', ') },
    })
    return
  }

  const patient = await findPatientForDoctor(req.doctorId as string, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  await Patient.updateOne(
    { _id: patient._id },
    { $set: { riskScore }, $inc: { serverVersion: 1 } }
  )
  const updated = await Patient.findById(patient._id).lean()

  await recordAudit({
    doctorId: req.doctorId as string,
    actor: 'clinician',
    action: 'patient.risk_changed',
    entityType: 'patient',
    entityId: patient.clientId,
    summary: `Risk set to ${riskScore}`,
    detail: { previous: patient.riskScore, next: riskScore },
  })

  res.json({ id: patient.clientId, riskScore: updated?.riskScore ?? riskScore })
}
