import { Response } from 'express'
import { Patient } from '../models/Patient'
import { Hospital } from '../models/Hospital'
import { sendWhatsAppMessage, buildDispatchMessage } from '../services/whatsapp'
import { env } from '../config/env'
import type { AuthRequest } from '../middleware/auth'
export async function dispatchCarePlan(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({
    _id: req.params.id,
    doctorId: req.doctorId,
  })
  if (!patient) {
    res.status(404).json({ success: false, error: 'Patient not found.' })
    return
  }
  if (!patient.signal?.approvedAt) {
    res.status(409).json({ success: false, error: 'Patient does not have an approved signal yet.' })
    return
  }
  const { channel = 'whatsapp', personalNote } = req.body as {
    channel?: string
    personalNote?: string
  }
  const hospital = await Hospital.findById(patient.hospitalId).lean()
  const hospitalName = hospital?.name || 'your hospital'
  const checkInUrl = `${env.FRONTEND_URL}/patient/${patient.checkInToken}`
  const messageBody = buildDispatchMessage(
    patient.name,
    hospitalName,
    patient.signal.patientSummary,
    checkInUrl,
    personalNote
  )
  await sendWhatsAppMessage(patient.phoneNumber, messageBody)
  res.json({
    success: true,
    data: {
      channel,
      sentTo: patient.phoneNumber,
      sentAt: new Date().toISOString(),
      messagePreview: messageBody.substring(0, 200) + (messageBody.length > 200 ? '...' : ''),
    },
  })
}
