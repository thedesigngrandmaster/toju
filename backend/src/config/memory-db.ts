import fs from 'fs'
import path from 'path'

interface DevMongoServer {
  getUri(): string
  stop(): Promise<boolean>
}

/**
 * Development-only Mongo fallback.
 *
 * A real MONGODB_URI always wins. When it is absent in development, Toju starts
 * a file-backed MongoDB process so `npm run dev` works without installing
 * MongoDB locally. Data survives restarts in backend/.mongo-data.
 */
let memoryServer: DevMongoServer | null = null

const DATA_DIR = path.resolve(process.cwd(), '.mongo-data')
const URI_FILE = path.resolve(process.cwd(), '.mongo-uri')

export function readDevMongoUri(): string | null {
  try {
    const uri = fs.readFileSync(URI_FILE, 'utf8').trim()
    return uri || null
  } catch {
    return null
  }
}

export async function startDevMongo(): Promise<string> {
  if (memoryServer) return memoryServer.getUri()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  // MongoDB 4.4 is used for the dev fallback because it runs on CPUs without
  // AVX (MongoDB 5+ crashes with SIGILL on older hardware). The Ubuntu 20.04
  // build needs libssl1.1; scripts/lib/dev-env.mjs supplies it on Linux.
  if (process.platform === 'linux') {
    if (!process.env.MONGOMS_DISTRO) process.env.MONGOMS_DISTRO = 'ubuntu-20.04'
    if (!process.env.MONGOMS_VERSION) process.env.MONGOMS_VERSION = '4.4.29'
  }
  // Loaded lazily so production images can prune this development-only package.
  // A plain require inside the function keeps it out of the module top level.
  const { MongoMemoryServer } = require('mongodb-memory-server') as typeof import('mongodb-memory-server')
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbPath: DATA_DIR,
      storageEngine: 'wiredTiger',
    },
  })
  const uri = memoryServer.getUri()
  fs.writeFileSync(URI_FILE, uri, 'utf8')
  console.log(`[DB] Started development MongoDB at ${uri} (data: ${DATA_DIR})`)
  return uri
}

export async function stopDevMongo(): Promise<void> {
  if (!memoryServer) return
  await memoryServer.stop().catch(() => undefined)
  memoryServer = null
}

export function registerDevMongoShutdown(): void {
  const shutdown = () => {
    void stopDevMongo()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  process.once('exit', shutdown)
}
