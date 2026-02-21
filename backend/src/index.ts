import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { connectDB } from './config/db'
import routes from './routes'
import { startCronJobs } from './jobs/cron'
import { errorHandler } from './middleware/errorHandler'
const app = express()
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true }))  
app.use(cookieParser())
app.use('/v1', routes)
app.get('/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV }))
app.use(errorHandler)
async function bootstrap(): Promise<void> {
  await connectDB()
  app.listen(env.PORT, () => {
    console.log(`[SERVER] CareBridge API running on port ${env.PORT}`)
  })
  startCronJobs()
}
bootstrap()
