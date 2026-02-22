import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError'
import { env } from '../config/env'
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    })
    return
  }
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: 'Validation failed.',
      fields: (err as any).errors,
    })
    return
  }
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format.',
    })
    return
  }
  console.error('[UNHANDLED ERROR]', err)
  res.status(500).json({
    success: false,
    error: env.nodeEnv === 'production' ? 'Internal server error.' : err.message,
  })
}
