import { Response } from 'express'
import { Alert } from '../models/Alert'
import { Patient } from '../models/Patient'
import { recordAudit } from '../services/audit'
import { recomputePatientRisk } from '../services/risk'
import { idQuery, toAlertDTO } from '../services/serializers'
import type { AuthRequest } from '../middleware/auth'

export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const unresolved = req.query.unresolved === 'true'
  const filter: Record<string, unknown> = { doctorId: req.doctorId }
  if (unresolved) filter.resolved = false

  const alerts = await Alert.find(filter)
    .populate('patientId', 'name diagnosis riskScore clientId')
    .sort({ timestamp: -1 })
    .lean()

  const result = alerts.map((alert) => {
    const patient = alert.patientId as unknown as {
      _id?: unknown
      clientId?: string
      name?: string
    } | null
    return {
      ...toAlertDTO(alert, patient?.clientId),
      patientName: patient?.name ?? 'Unknown',
    }
  })

  res.json({ alerts: result })
}

export async function resolveAlert(req: AuthRequest, res: Response): Promise<void> {
  const alert = await Alert.findOne({ doctorId: req.doctorId, ...idQuery(req.params.id) })
  if (!alert) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } })
    return
  }

  if (!alert.resolved) {
    alert.resolved = true
    alert.resolvedAt = new Date()
    alert.serverVersion += 1
    await alert.save()
    await recomputePatientRisk(String(alert.patientId))
  }

  const patient = await Patient.findById(alert.patientId).lean()
  await recordAudit({
    doctorId: req.doctorId as string,
    actor: 'clinician',
    action: 'alert.resolved',
    entityType: 'alert',
    entityId: alert.clientId,
    summary: `Resolved alert for ${patient?.name ?? 'patient'}`,
    detail: { type: alert.type, message: alert.message },
  })

  res.json({
    ...toAlertDTO(alert.toObject(), patient?.clientId),
    patientName: patient?.name ?? 'Unknown',
  })
}
