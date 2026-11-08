import { Types } from 'mongoose'
import { Patient } from '../models/Patient'
import { Alert } from '../models/Alert'
import { CheckIn } from '../models/CheckIn'
import { Note } from '../models/Note'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDoc = Record<string, any>

export function toId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toString()
  if (typeof value === 'object' && 'clientId' in (value as AnyDoc)) return String((value as AnyDoc).clientId)
  if (typeof value === 'object' && '_id' in (value as AnyDoc)) return String((value as AnyDoc)._id)
  return String(value)
}

export function normalizeSignal(signal: AnyDoc | null | undefined): AnyDoc | null {
  if (!signal) return null
  return {
    patientSummary: signal.patientSummary ?? '',
    diagnosis: signal.diagnosis ?? '',
    rawNotes: signal.rawNotes ?? '',
    redFlags: Array.isArray(signal.redFlags) ? signal.redFlags : [],
    confidence: typeof signal.confidence === 'number' ? signal.confidence : 0,
    approvedAt: signal.approvedAt ?? null,
    approvedBy: signal.approvedBy ? String(signal.approvedBy) : null,
    provenance: signal.provenance ?? null,
    medications: (signal.medications ?? []).map((med: AnyDoc, index: number) => ({
      name: med.name ?? '',
      dose: med.dose ?? '',
      frequency: med.frequency ?? '',
      status: med.status ?? 'continued',
      confidence: typeof med.confidence === 'number' ? med.confidence : 0,
      id: med.id ?? String(med._id ?? `med-${index}`),
    })),
    monitoringSchedule: (signal.monitoringSchedule ?? []).map((item: AnyDoc, index: number) => ({
      question: item.question ?? '',
      frequency: item.frequency ?? 'daily',
      time: item.time ?? null,
      id: item.id ?? String(item._id ?? `mon-${index}`),
    })),
  }
}

export function toPatientDTO(patient: AnyDoc, extras: Record<string, unknown> = {}): AnyDoc {
  return {
    id: patient.clientId ?? String(patient._id),
    doctorId: String(patient.doctorId),
    name: patient.name,
    age: patient.age ?? 0,
    diagnosis: patient.diagnosis ?? '',
    admittedDate: patient.admittedDate,
    dischargedDate: patient.dischargedDate,
    riskScore: patient.riskScore ?? 'unmonitored',
    phoneNumber: patient.phoneNumber,
    language: patient.language ?? 'english',
    lastCheckIn: patient.lastCheckIn ?? null,
    signal: normalizeSignal(patient.signal),
    checkIns: [],
    alerts: [],
    notes: [],
    serverVersion: patient.serverVersion ?? 1,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    ...extras,
  }
}

export function toAlertDTO(alert: AnyDoc, patientClientId?: string): AnyDoc {
  return {
    id: alert.clientId ?? String(alert._id),
    patientId: patientClientId ?? String(alert.patientId),
    timestamp: alert.timestamp,
    type: alert.type,
    message: alert.message,
    resolved: Boolean(alert.resolved),
    resolvedAt: alert.resolvedAt ?? null,
    severity: alert.severity ?? (alert.type === 'red_flag' ? 'critical' : 'warning'),
  }
}

export function toCheckInDTO(checkIn: AnyDoc, patientClientId?: string): AnyDoc {
  return {
    id: checkIn.clientId ?? String(checkIn._id),
    patientId: patientClientId ?? String(checkIn.patientId),
    timestamp: checkIn.timestamp,
    message: checkIn.message,
    riskScore: checkIn.riskScore,
    triggeredFlags: checkIn.triggeredFlags ?? [],
    botResponse: checkIn.botResponse ?? '',
    aiStatus: checkIn.aiStatus ?? 'ready',
    provenance: checkIn.provenance ?? null,
  }
}

export function toNoteDTO(note: AnyDoc, patientClientId?: string): AnyDoc {
  return {
    id: note.clientId ?? String(note._id),
    patientId: patientClientId ?? String(note.patientId),
    body: note.body,
    authorId: note.authorId,
    authorName: note.authorName,
    createdAt: note.createdAt,
  }
}

export function idQuery(id: string): Record<string, unknown> {
  if (Types.ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ clientId: id }, { _id: id }] }
  }
  return { clientId: id }
}

export async function findPatientForDoctor(doctorId: string, id: string): Promise<any | null> {
  return Patient.findOne({ doctorId, ...idQuery(id) }).lean()
}

export async function findAlertForDoctor(doctorId: string, id: string): Promise<any | null> {
  return Alert.findOne({ doctorId, ...idQuery(id) }).lean()
}

export async function findCheckInForDoctor(doctorId: string, id: string): Promise<any | null> {
  return CheckIn.findOne({ doctorId, ...idQuery(id) }).lean()
}

export async function findNoteForDoctor(doctorId: string, id: string): Promise<any | null> {
  return Note.findOne({ doctorId, ...idQuery(id) }).lean()
}

export async function patientClientIdMap(patientIds: unknown[]): Promise<Map<string, string>> {
  const rows = await Patient.find({ _id: { $in: patientIds } })
    .select('clientId')
    .lean()
  return new Map(rows.map((row) => [String(row._id), row.clientId ?? String(row._id)]))
}
