import { Response } from 'express'
import { Alert } from '../models/Alert'
import { Patient } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'
import type { AuthRequest } from '../middleware/auth'

export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const unresolved = req.query.unresolved === 'true'
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (unresolved) filter.resolved = false

  const alerts = await Alert.find(filter)
    .populate('patientId', 'name diagnosis riskScore')
    .sort({ timestamp: -1 })
    .lean()

  const result = alerts.map((a) => {
    const patient = a.patientId as any
    return {
      id: a._id,
      patientId: patient?._id ?? a.patientId,
      patientName: patient?.name ?? 'Unknown',
      timestamp: a.timestamp,
      type: a.type,
      message: a.message,
      resolved: a.resolved,
    }
  })

  res.json({ alerts: result })
}

export async function resolveAlert(req: AuthRequest, res: Response): Promise<void> {
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { resolved: true, resolvedAt: new Date() },
    { new: true }
  ).lean()

  if (!alert) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } })
    return
  }

  const unresolvedCount = await Alert.countDocuments({
    patientId: alert.patientId,
    resolved: false,
  })

  if (unresolvedCount === 0) {
    const latestCheckIn = await CheckIn.findOne({ patientId: alert.patientId })
      .sort({ timestamp: -1 })
      .lean()

    let newRisk: string = 'green'
    if (latestCheckIn?.riskScore === 'yellow') newRisk = 'yellow'
    if (latestCheckIn?.riskScore === 'red') newRisk = 'yellow'

    await Patient.updateOne({ _id: alert.patientId }, { riskScore: newRisk })
  }

  res.json({
    id: alert._id,
    resolved: true,
    resolvedAt: alert.resolvedAt,
  })
}
