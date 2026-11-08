import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { connectDB } from './config/db'
import routes from './routes'
import { startCronJobs } from './jobs/cron'
import { initWhatsApp } from './services/whatsapp'
import { backfillLegacyRecords, syncDatabaseIndexes } from './services/migrations'
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

// Custom CORS middleware — the `cors` package calls next() when the origin does
// not match, which produced confusing 405 responses on OPTIONS preflight.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (origin && (allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
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
    whatsappEnabled: env.whatsappEnabled,
    time: new Date().toISOString(),
  })
)

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

app.use(errorHandler)

async function bootstrap(): Promise<void> {
  await connectDB()
  await backfillLegacyRecords()
  await syncDatabaseIndexes()

  app.listen(env.port, () => {
    console.log(`[SERVER] Toju API running on http://localhost:${env.port}`)
    console.log(`[SERVER] Allowed web origin: ${allowedOrigins.join(', ')}`)
  })

  // WhatsApp is started in the background: the API must remain available even
  // when a Chromium session is still linking or temporarily unavailable.
  initWhatsApp().catch((error) => console.error('[WA] Init error:', error))
  startCronJobs()
}

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason)
})

bootstrap().catch((error) => {
  console.error('[SERVER] Fatal startup error:', error)
  process.exit(1)
})
