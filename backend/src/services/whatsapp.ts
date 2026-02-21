import { env } from '../config/env'
import { logger } from '../utils/logger'
export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  if (env.NODE_ENV === 'production' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    const twilio = await import('twilio')
    const client = twilio.default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    await client.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body,
    })
    logger.info(`[WhatsApp] Sent to ${to}`)
  } else {
    logger.info(`[WhatsApp MOCK] To: ${to}`)
    logger.info(`[WhatsApp MOCK] Body:\n${body}`)
  }
}
export function buildDispatchMessage(
  patientName: string,
  hospitalName: string,
  summary: string,
  checkInUrl: string,
  personalNote?: string
): string {
  let msg = `Good day ${patientName}! This is CareBridge Sentinel — your personal health companion from ${hospitalName}.\n\n`
  msg += `${summary}\n\n`
  msg += `📋 You can check in with us daily using this link:\n${checkInUrl}\n`
  if (personalNote) {
    msg += `\n💬 Note from your doctor: ${personalNote}\n`
  }
  msg += `\nWe are here to support your recovery. 💙`
  return msg
}