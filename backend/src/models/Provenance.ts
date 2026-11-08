import { Schema } from 'mongoose'

export type AiSource = 'gemini' | 'offline-rule' | 'clinician' | 'server-fallback'

export interface IProvenance {
  model: string
  promptVersion: string
  generatedAt: Date
  source: AiSource
  confidence: number
}

/**
 * Versioned AI provenance stored alongside every AI-derived clinical field.
 * A model name without a prompt version is not auditable, so both are required.
 */
export const ProvenanceSchema = new Schema<IProvenance>(
  {
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ['gemini', 'offline-rule', 'clinician', 'server-fallback'],
      required: true,
    },
    confidence: { type: Number, default: 0 },
  },
  { _id: false }
)
