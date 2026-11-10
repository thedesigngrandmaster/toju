import { Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'
import { getPatientRow, listCheckInRows } from '../repo'
import { toCheckInDTO } from '../dto'

export async function listCheckIns(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const page = Math.max(1, Number(req.query.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)))
  const all = await listCheckInRows(patient.id, page * limit)
  const start = (page - 1) * limit
  const checkIns = all.slice(start, start + limit)

  res.json({
    checkIns: checkIns.map((checkIn) => toCheckInDTO(checkIn, patient.client_id)),
    total: all.length,
    page,
    totalPages: Math.ceil(all.length / limit),
  })
}
