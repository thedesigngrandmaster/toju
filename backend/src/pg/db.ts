import dns from 'node:dns'
import { Pool, type QueryResultRow } from 'pg'
import { env } from '../config/env'

// Neon's hostname resolves to several IPv4 and IPv6 addresses. Some networks
// black-hole the IPv6 route, which makes the first connection wait for the
// happy-eyeballs fallback. Prefer IPv4 to keep cold starts predictable.
dns.setDefaultResultOrder('ipv4first')

const connectionString = env.databaseUrl

if (!connectionString) {
  console.warn('[PG] DATABASE_URL is not configured. Set it in backend/.env or the deployment environment.')
}

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl:
    connectionString && (connectionString.includes('neon.tech') || env.nodeEnv === 'production')
      ? { rejectUnauthorized: false }
      : undefined,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
})

pool.on('error', (error) => {
  console.error('[PG] Idle client error:', error.message)
})

function assertConfigured(): void {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  assertConfigured()
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export async function execute(text: string, params: unknown[] = []): Promise<number> {
  assertConfigured()
  const result = await pool.query(text, params)
  return result.rowCount ?? 0
}
