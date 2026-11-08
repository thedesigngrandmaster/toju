import { Response } from 'express'
import { AuditLog } from '../models/AuditLog'
import type { AuthRequest } from '../middleware/auth'

export async function listAudit(req: AuthRequest, res: Response): Promise<void> {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)))
  const filter: Record<string, unknown> = { doctorId: req.doctorId }

  if (typeof req.query.actor === 'string' && ['clinician', 'system', 'ai'].includes(req.query.actor)) {
    filter.actor = req.query.actor
  }
  if (typeof req.query.entityId === 'string') filter.entityId = req.query.entityId

  const entries = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean()
  res.json({ entries })
}
