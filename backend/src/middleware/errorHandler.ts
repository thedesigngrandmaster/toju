import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/AppError'
import { env } from '../config/env'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? 'APP_ERROR',
        message: err.message,
      },
    })
    return
  }

  if (err.name === 'ValidationError') {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        fields: (err as unknown as { errors?: unknown }).errors,
      },
    })
    return
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Invalid ID format.' },
    })
    return
  }

  console.error('[UNHANDLED ERROR]', err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.nodeEnv === 'production' ? 'Internal server error.' : err.message,
    },
  })
}
