import { pool } from './db'
import { SCHEMA_SQL } from './schema'

export async function ensureSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL)
}
