import { Schema, model, Document, Types } from 'mongoose'

// ── Subdocument interfaces ────────────────────────────────────────────────────

export interface IMedication {
  name: string
  dose: string
  frequency: string
  status: 'continued' | 'started' | 'stopped' | 'adjusted'
  confidence: number
}

export interface IMonitoringItem {
  question: string
  frequency: 'daily' | 'weekly' | 'as_needed'
  time: string | null
}

export interface IClinicalSignal {
  patientSummary: string
  rawNotes: string
  medications: IMedication[]
  redFlags: string[]
  monitoringSchedule: IMonitoringItem[]
  diagnosis: string
  confidence: number
  approvedAt: Date | null
  approvedBy: Types.ObjectId | string | null
}

// ── Subdocument schemas ───────────────────────────────────────────────────────

const MedicationSchema = new Schema<IMedication>(
  {
    name: { type: String, required: true },
    dose: { type: String, required: true },
    frequency: { type: String, required: true },
    status: {
      type: String,
      enum: ['continued', 'started', 'stopped', 'adjusted'],
      required: true,
    },
    confidence: { type: Number, required: true },
  },
  { _id: true }
)

const MonitoringItemSchema = new Schema<IMonitoringItem>(
  {
    question: { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'as_needed'], required: true },
    time: { type: String, default: null },
  },
  { _id: true }
)

const ClinicalSignalSchema = new Schema<IClinicalSignal>(
  {
    patientSummary: { type: String, required: true },
    rawNotes: { type: String, required: true },
    medications: { type: [MedicationSchema], default: [] },
    redFlags: { type: [String], default: [] },
    monitoringSchedule: { type: [MonitoringItemSchema], default: [] },
    diagnosis: { type: String, required: true },
    confidence: { type: Number, required: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
  },
  { _id: false }
)

// ── Patient ───────────────────────────────────────────────────────────────────

export type RiskScore = 'red' | 'yellow' | 'green' | 'unmonitored'
export type PatientLanguage = 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa'

export interface IPatient extends Document {
  doctorId: Types.ObjectId
  hospitalId: Types.ObjectId
  name: string
  age: number
  phoneNumber: string
  language: PatientLanguage
  diagnosis: string
  admittedDate: Date
  dischargedDate: Date
  riskScore: RiskScore
  signal: IClinicalSignal | null
  lastCheckIn: Date | null
  checkInToken: string
  createdAt: Date
  updatedAt: Date
}

const PatientSchema = new Schema<IPatient>(
  {
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    phoneNumber: { type: String, required: true },
    language: {
      type: String,
      enum: ['english', 'pidgin', 'yoruba', 'igbo', 'hausa'],
      default: 'english',
    },
    diagnosis: { type: String, required: true },
    admittedDate: { type: Date, required: true },
    dischargedDate: { type: Date, required: true },
    riskScore: {
      type: String,
      enum: ['red', 'yellow', 'green', 'unmonitored'],
      default: 'unmonitored',
    },
    signal: { type: ClinicalSignalSchema, default: null },
    lastCheckIn: { type: Date, default: null },
    checkInToken: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
  }
)

PatientSchema.index({ doctorId: 1, riskScore: 1 })
PatientSchema.index({ hospitalId: 1 })

export const Patient = model<IPatient>('Patient', PatientSchema)
