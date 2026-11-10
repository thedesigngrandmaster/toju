import 'dotenv/config'
import { pool } from './db'
import { ensureSchema } from './ensure-schema'

async function main(): Promise<void> {
  await ensureSchema()
  console.log('[PG] Schema is ready.')
  await pool.end()
}

main().catch((error) => {
  console.error('[PG] Migration failed:', error)
  process.exit(1)
})
