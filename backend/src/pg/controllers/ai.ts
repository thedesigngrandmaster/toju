import { Response } from 'express'
import { analyzeCheckIn } from '../../services/ai'
import type { AuthRequest } from '../../middleware/auth'
import { getPatientRow, recordAudit } from '../repo'

export async function triage(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const body = (req.body ?? {}) as {
    patientId?: string
    message?: string
    language?: string
    localRisk?: 'red' | 'yellow' | 'green'
    localFlags?: string[]
  }

  if (!body.patientId || !body.message || body.message.trim().length === 0) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'patientId and message are required' },
    })
    return
  }

  const patient = await getPatientRow(doctorId, body.patientId)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const signal = patient.data?.signal ?? {}
  const redFlags = (signal.redFlags ?? []) as string[]
  const medications = (signal.medications ?? []).map(
    (med: { name: string; dose: string; frequency: string }) =>
      `${med.name} ${med.dose} ${med.frequency}`,
  )

  const analysis = await analyzeCheckIn(
    body.message.trim(),
    redFlags,
    patient.data?.name ?? 'Patient',
    patient.data?.diagnosis ?? '',
    medications,
    (body.language as typeof patient.data.language) ?? patient.data?.language ?? 'english',
    body.localRisk,
    Array.isArray(body.localFlags) ? body.localFlags : [],
  )

  await recordAudit({
    doctorId,
    actor: 'ai',
    action: 'triage.cloud_requested',
    entityType: 'patient',
    entityId: patient.client_id,
    summary: `Cloud triage returned ${analysis.riskScore.toUpperCase()} for ${patient.data?.name ?? 'patient'}`,
    promptVersion: analysis.provenance.promptVersion,
    model: analysis.provenance.model,
    detail: {
      riskScore: analysis.riskScore,
      triggeredFlags: analysis.triggeredFlags,
      localRisk: body.localRisk ?? null,
      source: analysis.provenance.source,
      message: body.message.slice(0, 280),
    },
  })

  res.json(analysis)
}
