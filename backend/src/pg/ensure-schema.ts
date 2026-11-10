import { pool } from './db'
import { SCHEMA_SQL } from './schema'

/**
 * Neon suspends idle databases, so the first connection after a pause can take
 * a few seconds. Retry briefly before giving up on local startup.
 */
export async function ensureSchema(): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await pool.query(SCHEMA_SQL)
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000))
      }
    }
  }
  throw lastError
}
