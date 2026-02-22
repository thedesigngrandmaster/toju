import express from 'express'
import cors from 'cors'
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

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server (no origin) or listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
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
