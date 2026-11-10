import app from './app'
import { env } from './config/env'
import { ensureSchema } from './pg/ensure-schema'

async function bootstrap(): Promise<void> {
  await ensureSchema()
  app.listen(env.port, () => {
    console.log(`[SERVER] Toju API running on http://localhost:${env.port}`)
    console.log('[SERVER] Database: PostgreSQL')
    console.log('[SERVER] WhatsApp bridge: disabled in the serverless backend')
  })
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('[SERVER] Fatal startup error:', error)
    process.exit(1)
  })
}

export default app
