import express from 'express'
import cors from 'cors'
import { env } from './config/env'
import { connectDB } from './config/db'
import routes from './routes'
import { startCronJobs } from './jobs/cron'

const app = express()

app.use(cors({ origin: env.frontendUrl, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true })) // needed for Twilio webhook

app.use('/v1', routes)

app.get('/health', (_req, res) => res.json({ ok: true, env: env.nodeEnv }))

async function bootstrap(): Promise<void> {
  await connectDB()
  app.listen(env.port, () => {
    console.log(`[SERVER] CareBridge API running on port ${env.port}`)
  })
  startCronJobs()
}

bootstrap()
