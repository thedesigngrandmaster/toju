import { Response } from 'express'
import crypto from 'crypto'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { extractSignal } from '../services/ai'
import type { AuthRequest } from '../middleware/auth'

export async function listPatients(req: AuthRequest, res: Response): Promise<void> {
  const { riskScore, search } = req.query
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (riskScore) filter.riskScore = riskScore
  if (search) filter.name = { $regex: search, $options: 'i' }

  const patients = await Patient.find(filter)
    .select('-signal.rawNotes')
    .sort({ riskScore: 1, updatedAt: -1 })
    .lean()
  res.json(patients)
}

export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId }).lean()
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  const [checkIns, alerts] = await Promise.all([
    CheckIn.find({ patientId: patient._id }).sort({ timestamp: -1 }).limit(20).lean(),
    Alert.find({ patientId: patient._id }).sort({ timestamp: -1 }).lean(),
  ])
  res.json({ ...patient, checkIns, alerts })
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as {
    name: string
    age: number
    phoneNumber: string
    diagnosis: string
    admittedDate: string
    dischargedDate: string
    hospitalId: string
  }
  const checkInToken = crypto.randomBytes(20).toString('hex')
  const patient = await Patient.create({
    ...body,
    doctorId: req.doctorId,
    checkInToken,
    riskScore: 'unmonitored',
  })
  res.status(201).json(patient)
}

export async function generateSignal(req: AuthRequest, res: Response): Promise<void> {
  const { rawNotes } = req.body as { rawNotes: string }
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId })
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  const extracted = await extractSignal(rawNotes)
  patient.signal = {
    ...extracted,
    rawNotes,
    approvedAt: null,
    approvedBy: null,
  } as any
  await patient.save()
  res.json(patient.signal)
}

export async function approveSignal(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId })
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  if (!patient.signal) {
    res.status(400).json({ error: 'No signal to approve' })
    return
  }
  (patient.signal as any).approvedAt = new Date()
  ;(patient.signal as any).approvedBy = req.doctorId
  patient.riskScore = 'green'
  await patient.save()
  res.json({ ok: true })
}

export async function updateRiskScore(req: AuthRequest, res: Response): Promise<void> {
  const { riskScore } = req.body as { riskScore: string }
  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { riskScore },
    { new: true }
  ).lean()
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  res.json(patient)
}
