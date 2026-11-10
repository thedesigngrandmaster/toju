import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const BACKEND_DIR = path.join(ROOT, 'backend')

function envFileHasDatabaseUrl() {
  const envPath = path.join(BACKEND_DIR, '.env')
  if (!fs.existsSync(envPath)) return false
  const contents = fs.readFileSync(envPath, 'utf8')
  return /^\s*(DATABASE_URL|POSTGRES_URL)\s*=\s*\S+/m.test(contents)
}

/**
 * The backend now talks to PostgreSQL. The old file-backed MongoDB fallback is
 * gone, so the only job here is to give a clear message when DATABASE_URL is
 * missing. dotenv loads backend/.env inside the API process.
 */
export async function prepareDevEnv() {
  const env = { ...process.env }
  if (env.DATABASE_URL || env.POSTGRES_URL || envFileHasDatabaseUrl()) return env

  console.warn('[dev] DATABASE_URL is not set.')
  console.warn('[dev] Copy backend/.env.example to backend/.env and point DATABASE_URL at PostgreSQL.')
  console.warn('[dev] For the hosted demo, use the Neon connection string from the Vercel project.')
  return env
}
