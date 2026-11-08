import { Response } from 'express'
import { Patient } from '../models/Patient'
import { analyzeCheckIn } from '../services/ai'
import { findPatientForDoctor } from '../services/serializers'
import { recordAudit } from '../services/audit'
import type { AuthRequest } from '../middleware/auth'

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

  const patient = await findPatientForDoctor(doctorId, body.patientId)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const redFlags = (patient.signal?.redFlags ?? []) as string[]
  const medications = (patient.signal?.medications ?? []).map(
    (med: { name: string; dose: string; frequency: string }) =>
      `${med.name} ${med.dose} ${med.frequency}`
  )

  const analysis = await analyzeCheckIn(
    body.message.trim(),
    redFlags,
    patient.name,
    patient.diagnosis,
    medications,
    (body.language as typeof patient.language) ?? patient.language,
    body.localRisk,
    Array.isArray(body.localFlags) ? body.localFlags : []
  )

  await recordAudit({
    doctorId,
    actor: 'ai',
    action: 'triage.cloud_requested',
    entityType: 'patient',
    entityId: patient.clientId,
    summary: `Cloud triage returned ${analysis.riskScore.toUpperCase()} for ${patient.name}`,
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

/** Lightweight patient lookup used by the AI queue and diagnostics screens. */
export async function patientContext(req: AuthRequest, res: Response): Promise<void> {
  const patient = await Patient.findOne({ doctorId: req.doctorId, clientId: req.params.id }).lean()
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }
  res.json({
    id: patient.clientId,
    redFlags: patient.signal?.redFlags ?? [],
    medications: (patient.signal?.medications ?? []).map((med) => med.name),
    language: patient.language,
  })
}
