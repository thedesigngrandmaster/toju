import { GoogleGenAI } from '@google/genai'
import { env } from '../config/env'

const ai = new GoogleGenAI({ apiKey: env.geminiKey })

export interface ExtractedSignal {
  age: number
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
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a clinical AI assistant. Extract structured discharge information from the following EMR notes and return ONLY valid JSON — no markdown, no explanation, no code fences.

EMR NOTES:
${rawNotes}

Return this exact JSON shape:
{
  "age": 45,
  "patientSummary": "Plain-language summary for the patient (2-3 sentences, simple language, 5th-grade reading level)",
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
      "question": "Check-in question to send the patient via WhatsApp",
      "frequency": "daily|weekly|as_needed",
      "time": "HH:MM or null"
    }
  ],
  "confidence": 0.94
}`,
  })

  const text = response.text ?? ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as ExtractedSignal
}

export interface RiskAnalysis {
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
}

export async function analyzeCheckIn(
  patientMessage: string,
  redFlags: string[],
  patientName: string,
  diagnosis: string,
  medications: string[]
): Promise<RiskAnalysis> {
  const firstName = patientName.split(' ')[0]
  const medList = medications.length > 0 ? medications.join(', ') : 'none recorded'

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are Toju, a caring clinical health assistant sending WhatsApp messages to a post-discharge patient. Analyze the patient's check-in message and return ONLY valid JSON — no markdown, no code fences.

Patient first name: ${firstName}
Diagnosis: ${diagnosis}
Current medications: ${medList}
Red flags to watch for: ${redFlags.join(', ') || 'none'}
Patient's message: "${patientMessage}"

Return this exact JSON:
{
  "riskScore": "red|yellow|green",
  "triggeredFlags": ["list of triggered red flag strings, or empty array"],
  "botResponse": "Your WhatsApp reply as Toju (2-3 sentences max). Rules: (1) Use their first name naturally in the reply, not as an opener. (2) Directly acknowledge what they specifically said — reference their words, not a generic greeting. (3) If green: give one specific, actionable care tip related to their diagnosis or a medication reminder. (4) If yellow: gently note the concern and advise what to do. (5) If red: tell them clearly to seek help immediately and contact their doctor. Never start with 'Hi [name], thanks for your message' or similar filler openers."
}

Scoring: red = red flag symptom or urgent concern; yellow = worry, missed dose, or unclear symptom; green = patient is well.`,
  })

  const text = response.text ?? ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as RiskAnalysis
}
