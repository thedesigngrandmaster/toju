import { Response } from 'express'
import { Alert } from '../models/Alert'
import { reevaluatePatientRisk } from '../services/risk'
import type { AuthRequest } from '../middleware/auth'
export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const resolved = req.query.resolved === 'true'
  const filter: Record<string, unknown> = {
    doctorId: req.doctorId,
    resolved,
  }
  if (req.query.type) filter.type = req.query.type
  const alerts = await Alert.find(filter)
    .populate('patientId', 'name diagnosis riskScore')
    .sort({ timestamp: -1 })
    .lean()
  res.json({
    success: true,
    data: {
      alerts: alerts.map(a => ({
        id: a._id,
        type: a.type,
        message: a.message,
        resolved: a.resolved,
        timestamp: a.timestamp,
        patient: a.patientId ? {
          id: (a.patientId as any)._id,
          name: (a.patientId as any).name,
          riskScore: (a.patientId as any).riskScore,
          diagnosis: (a.patientId as any).diagnosis,
        } : null,
      })),
      total: alerts.length,
    },
  })
}
export async function resolveAlert(req: AuthRequest, res: Response): Promise<void> {
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, doctorId: req.doctorId },
    { resolved: true, resolvedAt: new Date() },
    { new: true }
  ).lean()
  if (!alert) {
    res.status(404).json({ success: false, error: 'Alert not found.' })
    return
  }
  const newRisk = await reevaluatePatientRisk(String(alert.patientId))
  res.json({
    success: true,
    data: {
      alertId: alert._id,
      resolved: true,
      resolvedAt: alert.resolvedAt,
      patient: { id: alert.patientId, riskScore: newRisk },
    },
  })
}
