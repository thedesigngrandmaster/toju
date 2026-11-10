import { Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'
import { getAlertRow, listAlertRows, recomputePatientRisk, recordAudit, updateAlertData } from '../repo'
import { toAlertDTO } from '../dto'

export async function listAlerts(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const unresolved = req.query.unresolved === 'true'
  const alerts = await listAlertRows(doctorId, unresolved)
  res.json({
    alerts: alerts.map((alert) => ({
      ...toAlertDTO(alert, alert.patient_client_id),
      patientName: alert.patient_name ?? 'Unknown',
    })),
  })
}

export async function resolveAlert(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const alert = await getAlertRow(doctorId, req.params.id)
  if (!alert) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } })
    return
  }

  let updated = alert
  if (!alert.data?.resolved) {
    const result = await updateAlertData(alert.id, {
      ...(alert.data ?? {}),
      resolved: true,
      resolvedAt: new Date().toISOString(),
    })
    if (result) updated = result
    if (alert.patient_id) await recomputePatientRisk(alert.patient_id)
  }

  const patientName = alert.patient_name ?? 'patient'
  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'alert.resolved',
    entityType: 'alert',
    entityId: alert.client_id,
    summary: `Resolved alert for ${patientName}`,
    detail: { type: alert.data?.type, message: alert.data?.message },
  })

  res.json({
    ...toAlertDTO(updated, alert.patient_client_id),
    patientName,
  })
}
