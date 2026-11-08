import { Response } from 'express'
import { CheckIn } from '../models/CheckIn'
import { findPatientForDoctor, toCheckInDTO } from '../services/serializers'
import type { AuthRequest } from '../middleware/auth'

export async function listCheckIns(req: AuthRequest, res: Response): Promise<void> {
  const patient = await findPatientForDoctor(req.doctorId as string, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const page = Math.max(1, Number(req.query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))

  const [checkIns, total] = await Promise.all([
    CheckIn.find({ patientId: patient._id })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CheckIn.countDocuments({ patientId: patient._id }),
  ])

  res.json({
    checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, patient.clientId)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
