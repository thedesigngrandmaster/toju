import express, { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { connectDB } from './config/db'
import routes from './routes'
import { startCronJobs } from './jobs/cron'
import { initWhatsApp } from './services/whatsapp'

const app = express()

const allowedOrigins = [
  ...env.frontendUrl.split(',').map((s) => s.trim()),
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

// Custom CORS middleware — the `cors` npm package calls next() when origin
// doesn't match, causing Express to return 405 on OPTIONS preflight routes.
// This middleware always responds to OPTIONS with 204.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})
app.use(cookieParser())
app.use(express.json())

app.use('/v1', routes)

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }))

async function bootstrap(): Promise<void> {
  await connectDB()
  app.listen(env.port, () => {
    console.log(`[SERVER] Toju API running on port ${env.port}`)
  })
  initWhatsApp()
  startCronJobs()
}

bootstrap()
