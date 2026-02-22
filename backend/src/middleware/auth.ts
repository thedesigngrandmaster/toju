import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
export interface AuthRequest extends Request {
  doctorId?: string
}
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing token.' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = verifyAccessToken(token)
    req.doctorId = payload.sub
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' })
  }
}
