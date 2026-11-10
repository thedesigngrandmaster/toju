import dotenv from 'dotenv'
dotenv.config()

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  port: numberFromEnv(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  geminiKey: process.env.GEMINI_API_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  syncPageSize: numberFromEnv(process.env.SYNC_PAGE_SIZE, 300),
  whatsappEnabled: (process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true',
  whatsappAuthPath: process.env.WHATSAPP_AUTH_PATH || '.wwebjs_auth',
  whatsappChromePath: process.env.WHATSAPP_CHROME_PATH || '',
}
