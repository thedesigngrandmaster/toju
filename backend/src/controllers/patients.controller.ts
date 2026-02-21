import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { Doctor } from '../models/Doctor'
import { extractSignal } from '../services/ai'
import { env } from '../config/env'
import type { AuthRequest } from '../middleware/auth'
export async function listPatients(req: AuthRequest, res: Response): Promise<void> {
  const { risk, search, page: pageStr, limit: limitStr } = req.query
  const page = Math.max(1, Number(pageStr) || 1)
  const limit = Math.min(100, Math.max(1, Number(limitStr) || 20))
  const skip = (page - 1) * limit
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (risk) filter.riskScore = risk
  if (search) filter.name = { $regex: search, $options: 'i' }
  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .select('-signal.rawNotes')
      .sort({ riskScore: 1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Patient.countDocuments(filter),
  ])
  const patientIds = patients.map(p => p._id)
  const alertCounts = await Alert.aggregate([
    { $match: { patientId: { $in: patientIds }, resolved: false } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } },
  ])
  const alertMap = new Map(alertCounts.map(a => [String(a._id), a.count]))
  const data = patients.map(p => ({
    id: p._id,
    name: p.name,
    age: p.age,
    diagnosis: p.diagnosis,
    riskScore: p.riskScore,
    lastCheckIn: p.lastCheckIn,
    dischargedDate: p.dischargedDate,
    hasSignal: !!p.signal?.approvedAt,
    unresolvedAlerts: alertMap.get(String(p._id)) || 0,
    checkInToken: p.checkInToken,
  }))
  res.json({
    success: true,
    data: {
      patients: data,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
  })
}
export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  const doctor = await Doctor.findById(req.doctorId).lean()
  if (!doctor) {
    res.status(401).json({ success: false, error: 'Doctor not found.' })
    return
  }
  const checkInToken = uuidv4()
  const patient = await Patient.create({
    ...req.body,
    doctorId: req.doctorId,
    hospitalId: doctor.hospitalId,
    checkInToken,
    riskScore: 'unmonitored',
  })
  const checkInUrl = `${env.FRONTEND_URL}/patient/${checkInToken}`
  res.status(201).json({
    success: true,
    data: {
      id: patient._id,
      name: patient.name,
      age: patient.age,
      phoneNumber: patient.phoneNumber,
      diagnosis: patient.diagnosis,
      riskScore: patient.riskScore,
      checkInToken: patient.checkInToken,
      checkInUrl,
      admittedDate: patient.admittedDate,
      dischargedDate: patient.dischargedDate,
      hasSignal: false,
      createdAt: patient.createdAt,
    },
  })
}
export async function getPatient(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({
    _id: req.params.id,
    doctorId: req.doctorId,
  }).lean()
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  const [checkIns, alerts] = await Promise.all([
    CheckIn.find({ patientId: patient._id }).sort({ timestamp: -1 }).limit(10).lean(),
    Alert.find({ patientId: patient._id, resolved: false }).sort({ timestamp: -1 }).lean(),
  ])
  const checkInUrl = `${env.FRONTEND_URL}/patient/${patient.checkInToken}`
  res.json({
    success: true,
    data: {
      ...patient,
      id: patient._id,
      checkInUrl,
      checkIns: checkIns.map(c => ({
        id: c._id,
        message: c.message,
        riskScore: c.riskScore,
        triggeredFlags: c.triggeredFlags,
        botResponse: c.botResponse,
        timestamp: c.timestamp,
      })),
      alerts: alerts.map(a => ({
        id: a._id,
        type: a.type,
        message: a.message,
        resolved: a.resolved,
        timestamp: a.timestamp,
      })),
    },
  })
}
export async function updatePatient(req: AuthRequest, res: Response): Promise<void> {
  const allowedFields = ['name', 'phoneNumber', 'diagnosis', 'age', 'admittedDate', 'dischargedDate']
  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key]
    }
  }
  const patient = await Patient.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { $set: updates },
    { new: true, runValidators: true }
  ).lean()
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  res.json({ success: true, data: patient })
}
export async function extractSignalHandler(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({
    _id: req.params.id,
    doctorId: req.doctorId,
  }).lean()
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  const { rawNotes } = req.body as { rawNotes: string }
  if (!rawNotes) {
    res.status(400).json({ success: false, error: 'rawNotes is required.' })
    return
  }
  try {
    const draft = await extractSignal(rawNotes)
    res.json({ success: true, data: { draft, rawNotes } })
  } catch (err: any) {
    res.status(422).json({
      success: false,
      error: err.message || 'Could not extract a structured signal. Please check the note and try again.',
    })
  }
}
export async function approveSignalHandler(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({
    _id: req.params.id,
    doctorId: req.doctorId,
  })
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  const {
    rawNotes, patientSummary, diagnosis, overallConfidence,
    medications, redFlags, monitoringSchedule,
  } = req.body
  const formattedRedFlags = (redFlags || []).map((flag: string | { description: string }) =>
    typeof flag === 'string' ? { description: flag } : flag
  )
  const formattedMonitoringItems = (monitoringSchedule || []).map((item: any) => ({
    question: item.question,
    frequency: item.frequency,
    time: item.time || null,
  }))
  patient.signal = {
    rawNotes,
    patientSummary,
    diagnosis,
    overallConfidence: overallConfidence || 0.9,
    medications: medications || [],
    redFlags: formattedRedFlags,
    monitoringItems: formattedMonitoringItems,
    approvedAt: new Date(),
  } as any
  patient.riskScore = 'green'
  await patient.save()
  res.json({
    success: true,
    data: {
      approvedAt: patient.signal!.approvedAt,
      patient: { id: patient._id, riskScore: patient.riskScore },
    },
  })
}
export async function getSignal(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne(
    { _id: req.params.id, doctorId: req.doctorId },
    'signal'
  ).lean()
  if (!patient?.signal?.approvedAt) {
    res.status(404).json({ success: false, error: 'No approved signal found.' })
    return
  }
  res.json({ success: true, data: patient.signal })
}
