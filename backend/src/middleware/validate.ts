import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {}
        for (const issue of err.issues) {
          const path = issue.path.join('.')
          fields[path || '_'] = issue.message
        }
        res.status(422).json({
          success: false,
          error: 'Validation failed.',
          fields,
        })
        return
      }
      next(err)
    }
  }
}
