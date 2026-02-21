import { Response } from 'express'
import { Alert } from '../models/Alert'
import type { AuthRequest } from '../middleware/auth'

export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const unresolved = req.query.unresolved === 'true'
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (unresolved) filter.resolved = false

  const alerts = await Alert.find(filter)
    .populate('patientId', 'name diagnosis riskScore')
    .sort({ timestamp: -1 })
    .lean()
  res.json(alerts)
}

export async function resolveAlert(req: AuthRequest, res: Response): Promise<void> {
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { resolved: true, resolvedAt: new Date() },
    { new: true }
  ).lean()
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  res.json(alert)
}
