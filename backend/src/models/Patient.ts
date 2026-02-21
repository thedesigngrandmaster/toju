import { Schema, model, Document, Types } from 'mongoose'
export interface IMedication {
  name: string
  dose: string
  frequency: string
  status: 'continued' | 'started' | 'stopped' | 'adjusted'
  confidence: number
}
export interface IRedFlag {
  description: string
}
export interface IMonitoringItem {
  question: string
  frequency: 'daily' | 'weekly' | 'as_needed'
  time: string | null
}
export interface IClinicalSignal {
  rawNotes: string
  patientSummary: string
  diagnosis: string
  overallConfidence: number
  medications: IMedication[]
  redFlags: IRedFlag[]
  monitoringItems: IMonitoringItem[]
  approvedAt: Date | null
}
const MedicationSchema = new Schema<IMedication>(
  {
    name:       { type: String, required: true },
    dose:       { type: String, default: '—' },
    frequency:  { type: String, default: '—' },
    status:     { type: String, enum: ['continued', 'started', 'stopped', 'adjusted'], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
  },
  { _id: true }
)
const RedFlagSchema = new Schema<IRedFlag>(
  {
    description: { type: String, required: true },
  },
  { _id: true }
)
const MonitoringItemSchema = new Schema<IMonitoringItem>(
  {
    question:  { type: String, required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'as_needed'], required: true },
    time:      { type: String, default: null },
  },
  { _id: true }
)
const ClinicalSignalSchema = new Schema<IClinicalSignal>(
  {
    rawNotes:          { type: String, required: true },
    patientSummary:    { type: String, required: true },
    diagnosis:         { type: String, required: true },
    overallConfidence: { type: Number, min: 0, max: 1, required: true },
    medications:       [MedicationSchema],
    redFlags:          [RedFlagSchema],
    monitoringItems:   [MonitoringItemSchema],
    approvedAt:        { type: Date, default: null },
  },
  { timestamps: true, _id: true }
)
export type RiskScore = 'red' | 'yellow' | 'green' | 'unmonitored'
export interface IPatient extends Document {
  name: string
  age: number
  phoneNumber: string
  diagnosis: string
  admittedDate: Date
  dischargedDate: Date
  riskScore: RiskScore
  checkInToken: string
  doctorId: Types.ObjectId
  hospitalId: Types.ObjectId
  signal: IClinicalSignal | null
  lastCheckIn: Date | null
  createdAt: Date
  updatedAt: Date
}
const PatientSchema = new Schema<IPatient>(
  {
    name:           { type: String, required: true },
    age:            { type: Number, required: true },
    phoneNumber:    { type: String, required: true },
    diagnosis:      { type: String, required: true },
    admittedDate:   { type: Date, required: true },
    dischargedDate: { type: Date, required: true },
    riskScore:      { type: String, enum: ['red', 'yellow', 'green', 'unmonitored'], default: 'unmonitored' },
    checkInToken:   { type: String, required: true, unique: true },
    doctorId:       { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    hospitalId:     { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    signal:         { type: ClinicalSignalSchema, default: null },
    lastCheckIn:    { type: Date, default: null },
  },
  { timestamps: true }
)
PatientSchema.index({ doctorId: 1, riskScore: 1 })
PatientSchema.index({ checkInToken: 1 }, { unique: true })
export const Patient = model<IPatient>('Patient', PatientSchema)
