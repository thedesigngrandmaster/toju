import { Response } from 'express'
import crypto from 'crypto'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { extractSignal } from '../services/ai'
import { sendMessage } from '../services/whatsapp'
import type { AuthRequest } from '../middleware/auth'

export async function listPatients(req: AuthRequest, res: Response): Promise<void> {
  const { riskScore, search } = req.query
  const page = Math.max(1, Number(req.query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (riskScore) filter.riskScore = riskScore
  if (search) filter.name = { $regex: search, $options: 'i' }

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .select('-signal.rawNotes -signal.medications -signal.redFlags -signal.monitoringSchedule -signal.patientSummary')
      .sort({ riskScore: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ])

  const patientIds = patients.map((p) => p._id)
  const alertCounts = await Alert.aggregate([
    { $match: { patientId: { $in: patientIds } } },
    {
      $group: {
        _id: '$patientId',
        total: { $sum: 1 },
        unresolved: { $sum: { $cond: [{ $eq: ['$resolved', false] }, 1, 0] } },
      },
    },
  ])

  const alertMap = new Map(alertCounts.map((a) => [String(a._id), { total: a.total, unresolved: a.unresolved }]))

  const result = patients.map((p) => {
    const counts = alertMap.get(String(p._id)) || { total: 0, unresolved: 0 }
    return {
      id: p._id,
      name: p.name,
      age: p.age,
      diagnosis: p.diagnosis,
      admittedDate: p.admittedDate,
      dischargedDate: p.dischargedDate,
      doctorId: p.doctorId,
      riskScore: p.riskScore,
      phoneNumber: p.phoneNumber,
      language: p.language,
      lastCheckIn: p.lastCheckIn,
      signal: p.signal ? { approvedAt: p.signal.approvedAt, confidence: p.signal.confidence, diagnosis: p.signal.diagnosis } : null,
      alertCount: counts.total,
      unresolvedAlertCount: counts.unresolved,
    }
  })

  res.json({ patients: result, total, page, totalPages: Math.ceil(total / limit) })
}

export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId }).lean()
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const [checkIns, alerts] = await Promise.all([
    CheckIn.find({ patientId: patient._id }).sort({ timestamp: -1 }).limit(50).lean(),
    Alert.find({ patientId: patient._id }).sort({ timestamp: -1 }).lean(),
  ])

  const signal = patient.signal
    ? {
        ...patient.signal,
        medications: (patient.signal.medications ?? []).map((m: any) => ({
          ...m,
          id: String(m._id ?? ''),
        })),
        monitoringSchedule: (patient.signal.monitoringSchedule ?? []).map((s: any) => ({
          ...s,
          id: String(s._id ?? ''),
        })),
      }
    : null

  res.json({
    id: patient._id,
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
    signal,
    checkIns: checkIns.map((c) => ({
      id: c._id,
      timestamp: c.timestamp,
      message: c.message,
      riskScore: c.riskScore,
      triggeredFlags: c.triggeredFlags,
      botResponse: c.botResponse,
    })),
    alerts: alerts.map((a) => ({
      id: a._id,
      timestamp: a.timestamp,
      type: a.type,
      message: a.message,
      resolved: a.resolved,
    })),
  })
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  const { name, phoneNumber, language } = req.body as {
    name: string
    phoneNumber: string
    language: string
  }

  if (!name || name.length < 2) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Name must be at least 2 characters' } })
    return
  }
  if (!phoneNumber || !/^\+\d{10,15}$/.test(phoneNumber)) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Phone number must start with + followed by 10-15 digits' } })
    return
  }
  const validLanguages = ['english', 'pidgin', 'yoruba', 'igbo', 'hausa']
  if (!language || !validLanguages.includes(language)) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Language must be one of: ' + validLanguages.join(', ') } })
    return
  }

  const doctor = await Doctor.findById(req.doctorId).lean()
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Doctor not found' } })
    return
  }

  const checkInToken = crypto.randomBytes(20).toString('hex')
  const today = new Date()

  const patient = await Patient.create({
    name,
    phoneNumber,
    language,
    doctorId: req.doctorId,
    hospitalId: doctor.hospitalId,
    age: 0,
    diagnosis: 'Awaiting Signal',
    admittedDate: today,
    dischargedDate: today,
    checkInToken,
    riskScore: 'unmonitored',
  })

  res.status(201).json({
    id: patient._id,
    name: patient.name,
    phoneNumber: patient.phoneNumber,
    language: patient.language,
    riskScore: patient.riskScore,
    checkInToken: patient.checkInToken,
  })
}

export async function generateSignal(req: AuthRequest, res: Response): Promise<void> {
  const { rawNotes } = req.body as { rawNotes: string }
  if (!rawNotes || rawNotes.length < 50) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Raw notes must be at least 50 characters' } })
    return
  }

  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId })
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  try {
    const extracted = await extractSignal(rawNotes)
    res.json({
      ...extracted,
      rawNotes,
      approvedAt: null,
    })
  } catch (err) {
    console.error('[AI] Signal extraction failed:', err)
    res.status(502).json({ error: { code: 'AI_SERVICE_ERROR', message: 'Failed to extract signal from notes. Please try again.' } })
  }
}

export async function approveSignal(req: AuthRequest, res: Response): Promise<void> {
  const { signal } = req.body as { signal: Record<string, unknown> }
  if (!signal) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Signal data is required' } })
    return
  }

  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId })
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  patient.signal = {
    ...signal,
    approvedAt: new Date(),
    approvedBy: req.doctorId,
  } as any
  patient.riskScore = 'green'
  patient.diagnosis = (signal.diagnosis as string) || patient.diagnosis
  if (signal.age && typeof signal.age === 'number' && signal.age > 0) {
    patient.age = signal.age
  }
  await patient.save()

  const doctor = await Doctor.findById(req.doctorId).lean()
  const hospital = doctor ? await Hospital.findById(doctor.hospitalId).lean() : null
  const doctorName = doctor?.name ?? 'your doctor'
  const hospitalName = hospital?.name ?? 'your hospital'

  sendMessage(
    patient.phoneNumber,
    `Hello ${patient.name}, this is Toju, your health partner from ${hospitalName}. ${doctorName} has asked me to help you recover at home. Can we start our daily check-ins? (Reply YES)`
  ).catch((err) => console.error('[WA] Dispatch failed:', err))

  res.json({
    patient: {
      id: patient._id,
      riskScore: patient.riskScore,
      signal: patient.signal,
    },
    dispatched: true,
  })
}

export async function updateRiskScore(req: AuthRequest, res: Response): Promise<void> {
  const { riskScore } = req.body as { riskScore: string }
  const valid = ['red', 'yellow', 'green', 'unmonitored']
  if (!riskScore || !valid.includes(riskScore)) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'riskScore must be one of: ' + valid.join(', ') } })
    return
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { riskScore },
    { new: true }
  ).lean()
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  res.json({ id: patient._id, riskScore: patient.riskScore })
}
