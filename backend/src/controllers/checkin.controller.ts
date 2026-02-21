import { Request, Response } from 'express'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import { Alert } from '../models/Alert'
import { analyzeCheckIn } from '../services/ai'
import type { AuthRequest } from '../middleware/auth'

// POST /v1/checkin/:token  — inbound from Twilio WhatsApp webhook
export async function inboundCheckIn(req: Request, res: Response): Promise<void> {
  const { token } = req.params
  const body = (req.body as Record<string, string>).Body || ''

  const patient = await Patient.findOne({ checkInToken: token })
  if (!patient || !patient.signal) {
    res.status(404).json({ error: 'Patient or signal not found' })
    return
  }

  const analysis = await analyzeCheckIn(
    body,
    (patient.signal as any).redFlags ?? [],
    patient.name,
    patient.diagnosis
  )

  const checkIn = await CheckIn.create({
    patientId: patient._id,
    doctorId: patient.doctorId,
    message: body,
    riskScore: analysis.riskScore,
    triggeredFlags: analysis.triggeredFlags,
    botResponse: analysis.botResponse,
  })

  patient.riskScore = analysis.riskScore
  patient.lastCheckIn = new Date()
  await patient.save()

  if (analysis.riskScore === 'red') {
    await Alert.create({
      patientId: patient._id,
      doctorId: patient.doctorId,
      type: 'red_flag',
      message: `Red flag triggered: ${analysis.triggeredFlags.join(', ')}`,
    })
  }

  res.json({ checkIn, botResponse: analysis.botResponse })
}

// GET /v1/patients/:id/checkins  — dashboard
export async function listCheckIns(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.doctorId }).lean()
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' })
    return
  }
  const page = Number(req.query.page ?? 1)
  const limit = 20
  const checkIns = await CheckIn.find({ patientId: patient._id })
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
  res.json(checkIns)
}
