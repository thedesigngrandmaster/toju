import twilio from 'twilio'
import { env } from '../config/env'

const client = twilio(env.twilioAccountSid, env.twilioAuthToken)
b
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  await client.messages.create({
    from: env.twilioWhatsappFrom,
    to: `whatsapp:${to}`,
    body,
  })
}

export function buildCheckInMessage(
  patientName: string,
  question: string,
  checkInToken: string
): string {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:4000'
  return `Good morning ${patientName}! 👋\n\n${question}\n\nReply to this message with your answer.\n\n_CareBridge Sentinel — ${baseUrl}/checkin/${checkInToken}_`
}
