import { GoogleGenAI } from '@google/genai'
import { env } from '../config/env'
import type { PatientLanguage } from '../models/Patient'
import type { AiSource } from '../models/Provenance'
import { ruleBasedTriage, ruleBotResponse, SERVER_RULES_MODEL, SERVER_RULES_PROMPT_VERSION } from './rules'

export const AI_MODEL = 'gemini-2.5-flash'
export const SIGNAL_PROMPT_VERSION = 'signal-extraction@2.1.0'
export const TRIAGE_PROMPT_VERSION = 'triage-context@2.1.0'

const ai = new GoogleGenAI({ apiKey: env.geminiKey })

export interface AiProvenance {
  model: string
  promptVersion: string
  generatedAt: Date
  source: AiSource
  confidence: number
}

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
  provenance: AiProvenance
}

export interface RiskAnalysis {
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
  provenance: AiProvenance
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI response did not contain JSON')
  return JSON.parse(cleaned.slice(start, end + 1)) as T
}

function geminiProvenance(promptVersion: string, confidence = 0.9): AiProvenance {
  return {
    model: AI_MODEL,
    promptVersion,
    generatedAt: new Date(),
    source: 'gemini',
    confidence,
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Extracts a structured care signal from raw EMR notes. The prompt version is
 * persisted with the result so a clinician can audit which instructions produced
 * a given medication list.
 */
export async function extractSignal(rawNotes: string): Promise<ExtractedSignal> {
  const response = await ai.models.generateContent({
    model: AI_MODEL,
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
}

Rules:
- Only include medications explicitly mentioned in the notes.
- Red flags must be concrete symptoms or readings the patient can recognise.
- Monitoring questions must be answerable in one WhatsApp message.
- If a value is unknown, use an empty string, empty array, or 0. Never invent data.`,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })

  const parsed = parseJson<Record<string, unknown>>(response.text ?? '')
  const rawMedications = Array.isArray(parsed.medications) ? parsed.medications : []
  const rawMonitoring = Array.isArray(parsed.monitoringSchedule) ? parsed.monitoringSchedule : []
  const validStatuses = new Set(['continued', 'started', 'stopped', 'adjusted'])
  const validFrequencies = new Set(['daily', 'weekly', 'as_needed'])

  const confidence = Math.min(1, Math.max(0, asNumber(parsed.confidence, 0.8)))

  return {
    age: Math.max(0, asNumber(parsed.age, 0)),
    patientSummary: asString(parsed.patientSummary),
    diagnosis: asString(parsed.diagnosis, 'Awaiting clinician review'),
    medications: rawMedications.map((item) => {
      const med = item as Record<string, unknown>
      const status = asString(med.status, 'continued')
      return {
        name: asString(med.name, 'Unknown medication'),
        dose: asString(med.dose, '—'),
        frequency: asString(med.frequency, '—'),
        status: (validStatuses.has(status) ? status : 'continued') as
          | 'continued'
          | 'started'
          | 'stopped'
          | 'adjusted',
        confidence: Math.min(1, Math.max(0, asNumber(med.confidence, confidence))),
      }
    }),
    redFlags: Array.isArray(parsed.redFlags)
      ? parsed.redFlags.filter((flag): flag is string => typeof flag === 'string' && flag.trim().length > 0)
      : [],
    monitoringSchedule: rawMonitoring.map((item) => {
      const row = item as Record<string, unknown>
      const frequency = asString(row.frequency, 'daily')
      return {
        question: asString(row.question),
        frequency: (validFrequencies.has(frequency) ? frequency : 'daily') as
          | 'daily'
          | 'weekly'
          | 'as_needed',
        time: typeof row.time === 'string' && row.time ? row.time : null,
      }
    }),
    confidence,
    provenance: geminiProvenance(SIGNAL_PROMPT_VERSION, confidence),
  }
}

/**
 * Classifies a patient WhatsApp message. If Gemini fails (quota, network,
 * malformed JSON) the deterministic rule engine is used instead, so a possible
 * RED flag is never lost because of a model outage.
 */
export async function analyzeCheckIn(
  patientMessage: string,
  redFlags: string[],
  patientName: string,
  diagnosis: string,
  medications: string[],
  language: PatientLanguage = 'english',
  localRisk?: 'red' | 'yellow' | 'green',
  localFlags: string[] = []
): Promise<RiskAnalysis> {
  const firstName = patientName.split(' ')[0]
  const medList = medications.length > 0 ? medications.join(', ') : 'none recorded'

  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: `You are Toju, a caring clinical health assistant sending WhatsApp messages to a post-discharge patient. Analyze the patient's check-in message and return ONLY valid JSON — no markdown, no code fences.

Patient first name: ${firstName}
Preferred reply language: ${language}
Diagnosis: ${diagnosis}
Current medications: ${medList}
Red flags to watch for: ${redFlags.join(', ') || 'none'}
Patient's message: "${patientMessage}"

Return this exact JSON:
{
  "riskScore": "red|yellow|green",
  "triggeredFlags": ["list of triggered red flag strings, or empty array"],
  "botResponse": "Your WhatsApp reply as Toju (2-3 sentences max). Rules: (1) Use their first name naturally in the reply, not as an opener. (2) Directly acknowledge what they specifically said — reference their words, not a generic greeting. (3) If green: give one specific, actionable care tip related to their diagnosis or a medication reminder. (4) If yellow: gently note the concern and advise what to do. (5) If red: tell them clearly to seek help immediately and contact their doctor. Never start with 'Hi [name], thanks for your message' or similar filler openers. (6) Write the reply in the preferred reply language."
}

Scoring: red = red flag symptom or urgent concern; yellow = worry, missed dose, or unclear symptom; green = patient is well.
Safety: if the patient describes chest pain, difficulty breathing, fainting, stroke signs, severe bleeding, or reduced consciousness, classify as red.`,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    })

    const parsed = parseJson<Record<string, unknown>>(response.text ?? '')
    let riskScore = asString(parsed.riskScore, 'green') as 'red' | 'yellow' | 'green'
    if (!['red', 'yellow', 'green'].includes(riskScore)) riskScore = 'green'

    const rank = { green: 0, yellow: 1, red: 2 }
    if (localRisk && rank[localRisk] > rank[riskScore]) riskScore = localRisk

    const triggeredFlags = Array.isArray(parsed.triggeredFlags)
      ? parsed.triggeredFlags.filter(
          (flag): flag is string => typeof flag === 'string' && flag.trim().length > 0
        )
      : []

    return {
      riskScore,
      triggeredFlags: [...new Set([...localFlags, ...triggeredFlags])],
      botResponse: asString(parsed.botResponse, ruleBotResponse(language, riskScore)),
      provenance: geminiProvenance(TRIAGE_PROMPT_VERSION, riskScore === 'red' ? 0.93 : 0.86),
    }
  } catch (error) {
    console.error('[AI] Triage failed, using rule fallback:', error instanceof Error ? error.message : error)
    const fallback = ruleBasedTriage(patientMessage, redFlags, localRisk, localFlags)
    return {
      riskScore: fallback.riskScore,
      triggeredFlags: fallback.triggeredFlags,
      botResponse: ruleBotResponse(language, fallback.riskScore),
      provenance: {
        model: SERVER_RULES_MODEL,
        promptVersion: SERVER_RULES_PROMPT_VERSION,
        generatedAt: new Date(),
        source: 'server-fallback',
        confidence: fallback.riskScore === 'red' ? 0.72 : fallback.riskScore === 'yellow' ? 0.62 : 0.55,
      },
    }
  }
}
