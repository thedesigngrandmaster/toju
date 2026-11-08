import { Response } from 'express'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { Patient } from '../models/Patient'
import type { AuthRequest } from '../middleware/auth'

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const doctor = await Doctor.findById(req.doctorId).lean()
  if (!doctor) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Doctor not found' } })
    return
  }
  const hospital = await Hospital.findById(doctor.hospitalId).lean()
  const counts = await Patient.aggregate([
    { $match: { doctorId: doctor._id } },
    { $group: { _id: '$riskScore', count: { $sum: 1 } } },
  ])
  const patientCounts = { total: 0, red: 0, yellow: 0, green: 0, unmonitored: 0 }
  for (const item of counts) {
    const key = item._id as keyof typeof patientCounts
    if (key in patientCounts) patientCounts[key] = item.count
    patientCounts.total += item.count
  }

  res.json({
    id: String(doctor._id),
    name: doctor.name,
    specialty: doctor.specialty ?? '',
    email: doctor.email,
    hospital: hospital?.name ?? '',
    patientCounts,
  })
}
