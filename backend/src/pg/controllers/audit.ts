import { Response } from 'express'
import type { AuthRequest } from '../../middleware/auth'
import { listAuditRows } from '../repo'
import { toAuditDTO } from '../dto'

export async function listAudit(req: AuthRequest, res: Response): Promise<void> {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)))
  const actor =
    typeof req.query.actor === 'string' && ['clinician', 'system', 'ai'].includes(req.query.actor)
      ? req.query.actor
      : undefined
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined
  const entries = await listAuditRows(req.doctorId as string, { actor, entityId, limit })
  res.json({ entries: entries.map(toAuditDTO) })
}
