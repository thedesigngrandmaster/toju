import { Request, Response } from 'express'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { analyzePatientResponse } from '../services/ai'
import type { AuthRequest } from '../middleware/auth'
export async function getPatientProfile(req: Request, res: Response): Promise<void> {
  const { token } = req.params
  const patient = await Patient.findOne(
    { checkInToken: token },
    'name diagnosis signal.monitoringItems signal.redFlags signal.approvedAt'
  ).lean()
  if (!patient || !patient.signal?.approvedAt) {
    res.status(404).json({ success: false, error: 'Invalid check-in link.' })
    return
  }
  const monitoringQuestions = (patient.signal.monitoringItems || []).map(
    (item: any) => item.question
  )
  const firstName = patient.name.split(' ')[0]
  res.json({
    success: true,
    data: {
      patient: {
        id: patient._id,
        name: patient.name,
        diagnosis: patient.diagnosis,
      },
      monitoringQuestions,
      botGreeting: `Good morning, ${firstName}! I am checking in on you today. How are you feeling?`,
    },
  })
}
export async function submitCheckIn(req: Request, res: Response): Promise<void> {
  const { token } = req.params
  const { message } = req.body as { message: string }
  if (!message) {
    res.status(400).json({ success: false, error: 'Message is required.' })
    return
  }
  const patient = await Patient.findOne({ checkInToken: token })
  if (!patient || !patient.signal?.approvedAt) {
    res.status(404).json({ success: false, error: 'Invalid check-in link.' })
    return
  }
  const redFlags = (patient.signal?.redFlags || []).map((r: any) => r.description)
  const analysis = await analyzePatientResponse(patient.name, message, redFlags)
  await CheckIn.create({
    patientId: patient._id,
    message,
    riskScore: analysis.riskScore,
    triggeredFlags: analysis.triggeredFlags,
    botResponse: analysis.botResponse,
    timestamp: new Date(),
  })
  patient.riskScore = analysis.riskScore
  patient.lastCheckIn = new Date()
  await patient.save()
  if (analysis.alertProvider) {
    await Alert.create({
      patientId: patient._id,
      doctorId: patient.doctorId,
      type: 'red_flag',
      message: `${patient.name} reported: ${analysis.triggeredFlags.join(', ')}`,
    })
  }
  res.json({
    success: true,
    data: {
      riskScore: analysis.riskScore,
      triggeredFlags: analysis.triggeredFlags,
      botResponse: analysis.botResponse,
      alertSent: analysis.alertProvider,
    },
  })
}
export async function listCheckIns(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({
    _id: req.params.id,
    doctorId: req.doctorId,
  }).lean()
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const skip = (page - 1) * limit
  const query: Record<string, unknown> = { patientId: patient._id }
  if (req.query.risk) query.riskScore = req.query.risk
  const [checkIns, total] = await Promise.all([
    CheckIn.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    CheckIn.countDocuments(query),
  ])
  res.json({
    success: true,
    data: {
      checkIns: checkIns.map(c => ({
        id: c._id,
        message: c.message,
        riskScore: c.riskScore,
        triggeredFlags: c.triggeredFlags,
        botResponse: c.botResponse,
        timestamp: c.timestamp,
      })),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    },
  })
}
