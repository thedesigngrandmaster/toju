import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env'
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const SIGNAL_EXTRACTION_SYSTEM_PROMPT = `You are a clinical data extraction specialist working for a hospital discharge monitoring system.
Given a raw hospital discharge note or EMR text, extract a structured care plan.
Be conservative — if you are not certain about a value, lower its confidence score.
Never invent or assume information not present in the source text.
Return ONLY valid JSON with exactly this structure:
{
  "patientSummary": "<max 120 words, plain language, 5th-grade reading level, address patient as 'you'>",
  "diagnosis": "<primary diagnosis string>",
  "overallConfidence": <0.0–1.0>,
  "medications": [
    { "name": "string", "dose": "string or '—'", "frequency": "string or '—'",
      "status": "continued|started|stopped|adjusted", "confidence": 0.0–1.0 }
  ],
  "redFlags": ["plain language symptom to watch for"],
  "monitoringSchedule": [
    { "question": "friendly check-in question spoken to patient",
      "frequency": "daily|weekly|as_needed", "time": "HH:MM or null" }
  ]
}
If the text is not a medical document, return:
{ "error": "NOT_MEDICAL_DOCUMENT" }`
const PATIENT_ANALYSIS_SYSTEM_PROMPT = `You are a compassionate patient monitoring AI for a post-discharge care system.
Analyze the patient's message against their red-flag symptom list.
Rules:
- Red-flag symptom mentioned → riskScore: "red", alertProvider: true
- Vague concern, no specific flag → riskScore: "yellow", alertProvider: false
- Positive / adherent message → riskScore: "green", alertProvider: false
- botResponse: max 80 words, warm, simple English
- If alertProvider is true, tell the patient their doctor has been notified
- Never give specific dosage instructions
Return ONLY valid JSON:
{
  "riskScore": "red|yellow|green",
  "triggeredFlags": ["matched flag description"],
  "botResponse": "response string",
  "alertProvider": true|false,
  "sentiment": "positive|neutral|concerned|alarmed"
}`
export interface ExtractedSignal {
  patientSummary: string
  diagnosis: string
  overallConfidence: number
  medications: Array<{
    name: string
    dose: string
    frequency: string
    status: 'continued' | 'started' | 'stopped' | 'adjusted'
    confidence: number
  }>
  redFlags: string[]
  monitoringSchedule: Array<{
    question: string
    frequency: 'daily' | 'weekly' | 'as_needed'
    time: string | null
  }>
}
export async function extractSignal(rawNotes: string): Promise<ExtractedSignal> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SIGNAL_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: rawNotes }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)
  if (parsed.error === 'NOT_MEDICAL_DOCUMENT') {
    throw new Error('The provided text does not appear to be a clinical note.')
  }
  return parsed
}
export interface PatientAnalysis {
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
  alertProvider: boolean
  sentiment: 'positive' | 'neutral' | 'concerned' | 'alarmed'
}
export async function analyzePatientResponse(
  patientName: string,
  message: string,
  redFlags: string[]
): Promise<PatientAnalysis> {
  const userContent = `Patient name: ${patientName}\nPatient message: "${message}"\nRed flags: ${JSON.stringify(redFlags)}`
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: PATIENT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
