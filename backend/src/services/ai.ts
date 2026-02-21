import Anthropic from '@anthropic-ai/sdk'
import { env } from '../config/env'

const client = new Anthropic({ apiKey: env.anthropicKey })

// ── Signal Extraction ─────────────────────────────────────────────────────────

export interface ExtractedSignal {
  patientSummary: string
  diagnosis: string
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
  confidence: number
}

export async function extractSignal(rawNotes: string): Promise<ExtractedSignal> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a clinical AI assistant. Extract structured discharge information from the following EMR notes and return ONLY valid JSON — no markdown, no explanation.

EMR NOTES:
${rawNotes}

Return this exact JSON shape:
{
  "patientSummary": "Plain-language summary for the patient (2-3 sentences, simple language)",
  "diagnosis": "Primary diagnosis string",
  "medications": [
    {
      "name": "Drug name",
      "dose": "e.g. 40mg",
      "frequency": "e.g. Once daily",
      "status": "continued|started|stopped|adjusted",
      "confidence": 0.95
    }
  ],
  "redFlags": ["Warning symptom 1", "Warning symptom 2"],
  "monitoringSchedule": [
    {
      "question": "Check-in question to send the patient",
      "frequency": "daily|weekly|as_needed",
      "time": "HH:MM or null"
    }
  ],
  "confidence": 0.94
}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text) as ExtractedSignal
}

// ── Check-In Risk Analysis ────────────────────────────────────────────────────

export interface RiskAnalysis {
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
}

export async function analyzeCheckIn(
  patientMessage: string,
  redFlags: string[],
  patientName: string,
  diagnosis: string
): Promise<RiskAnalysis> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a clinical triage AI. Analyze a patient's check-in message and return ONLY valid JSON.

Patient: ${patientName}
Diagnosis: ${diagnosis}
Red flags to watch for: ${redFlags.join(', ')}
Patient's message: "${patientMessage}"

Return this exact JSON:
{
  "riskScore": "red|yellow|green",
  "triggeredFlags": ["list of triggered red flag strings, or empty array"],
  "botResponse": "Empathetic WhatsApp reply to the patient in simple English (2-3 sentences)"
}

Scoring: red = red flag triggered or urgent symptom; yellow = concern or missed dose; green = all well.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text) as RiskAnalysis
}
