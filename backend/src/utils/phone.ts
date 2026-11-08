/** Returns digits only, which is the common denominator for WhatsApp chat ids. */
export function normalizePhone(input: string): string {
  return (input || '').replace(/\D/g, '')
}

/** WhatsApp chat id for a phone number (e.g. 2348012345678@c.us). */
export function toChatId(input: string): string {
  return `${normalizePhone(input)}@c.us`
}

/** Display/storage phone number with a leading + when possible. */
export function toDisplayPhone(input: string): string {
  const digits = normalizePhone(input)
  return digits ? `+${digits}` : ''
}
