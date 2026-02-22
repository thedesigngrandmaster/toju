import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { connectDB } from './config/db'
import routes from './routes'
import { startCronJobs } from './jobs/cron'
import { initWhatsApp } from './services/whatsapp'

const app = express()

app.use(cors({ origin: env.frontendUrl, credentials: true }))
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
