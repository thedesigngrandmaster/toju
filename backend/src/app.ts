import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import routes from './pg/routes'
import { errorHandler } from './middleware/errorHandler'

const app = express()
app.set('trust proxy', 1)

const allowedOrigins = [
  ...env.frontendUrl.split(',').map((origin) => origin.trim()),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
].filter(Boolean)

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true
  if (/^https:\/\/toju-(frontend|ts|a)-[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true
  return false
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

app.use(cookieParser())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

app.use('/v1', routes)

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    env: env.nodeEnv,
    service: 'toju-api',
    database: env.databaseUrl ? 'postgres' : 'unconfigured',
    whatsappEnabled: false,
    time: new Date().toISOString(),
  }),
)

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

app.use(errorHandler)

export default app
