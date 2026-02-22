import mongoose from 'mongoose'
import { env } from './env'
export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI)
    console.log('[DB] Connected to MongoDB')
  } catch (err) {
    console.error('[DB] Connection failed:', err)
    process.exit(1)
  }
}
