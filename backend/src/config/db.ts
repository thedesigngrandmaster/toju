import mongoose from 'mongoose'
import { env } from './env'
import { readDevMongoUri, registerDevMongoShutdown, startDevMongo } from './memory-db'

async function connect(uri: string, timeout = 15_000): Promise<void> {
  await mongoose.connect(uri, {
    // Indexes are built explicitly after the legacy backfill has run.
    autoIndex: false,
    serverSelectionTimeoutMS: timeout,
  })
}

export async function connectDB(): Promise<void> {
  try {
    if (env.mongoUri) {
      await connect(env.mongoUri)
      console.log('[DB] Connected to MongoDB')
      return
    }

    if (env.nodeEnv === 'production') {
      throw new Error('MONGODB_URI is required in production.')
    }

    // A previous dev process may have left a running memory Mongo behind.
    const existing = readDevMongoUri()
    if (existing) {
      try {
        await connect(existing, 3_000)
        console.log('[DB] Connected to development MongoDB')
        registerDevMongoShutdown()
        return
      } catch {
        await mongoose.disconnect().catch(() => undefined)
      }
    }

    const uri = await startDevMongo()
    await connect(uri)
    registerDevMongoShutdown()
    console.log('[DB] Connected to development MongoDB')
  } catch (err) {
    console.error('[DB] Connection failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
