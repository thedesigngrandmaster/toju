/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDoc = Record<string, any>

export interface DoctorRow {
  id: string
  email: string
  password_hash: string
  name: string
  specialty: string
  hospital_id: string | null
  refresh_token_hash: string | null
  created_at: Date
  updated_at: Date
  hospital_name?: string | null
}

export interface HospitalRow {
  id: string
  name: string
  address: string | null
  created_at: Date
  updated_at: Date
}

export interface PatientRow {
  id: string
  client_id: string
  doctor_id: string
  hospital_id: string | null
  data: AnyDoc
  server_version: number
  created_at: Date
  updated_at: Date
  unresolved_alert_count?: number
}

export interface AlertRow {
  id: string
  client_id: string
  doctor_id: string
  patient_id: string | null
  data: AnyDoc
  server_version: number
  created_at: Date
  updated_at: Date
  patient_client_id?: string | null
  patient_name?: string | null
}

export interface CheckInRow {
  id: string
  client_id: string
  doctor_id: string
  patient_id: string | null
  data: AnyDoc
  server_version: number
  created_at: Date
  updated_at: Date
  patient_client_id?: string | null
}

export interface NoteRow {
  id: string
  client_id: string
  doctor_id: string
  patient_id: string | null
  data: AnyDoc
  server_version: number
  created_at: Date
  updated_at: Date
  patient_client_id?: string | null
}

export interface SyncOperationRow {
  id: string
  operation_id: string
  doctor_id: string
  device_id: string | null
  entity_type: string | null
  entity_id: string | null
  op: string | null
  status: string | null
  result: AnyDoc | null
  error: string | null
  applied_at: Date
}

export interface AuditRow {
  id: string
  doctor_id: string
  actor: string
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  prompt_version: string | null
  model: string | null
  device_id: string | null
  detail: AnyDoc | null
  timestamp: Date
}

export interface OutboundRow {
  id: string
  idempotency_key: string | null
  doctor_id: string
  patient_id: string | null
  phone_number: string
  body: string
  kind: string
  priority: number
  status: string
  attempts: number
  last_error: string | null
  created_at: Date
  sent_at: Date | null
  next_attempt_at: Date
}

function iso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
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
    approvedBy: signal.approvedBy ?? null,
    provenance: signal.provenance ?? null,
    medications: (signal.medications ?? []).map((med: AnyDoc, index: number) => ({
      name: med.name ?? '',
      dose: med.dose ?? '',
      frequency: med.frequency ?? '',
      status: med.status ?? 'continued',
      confidence: typeof med.confidence === 'number' ? med.confidence : 0,
      id: med.id ?? `med-${index}`,
    })),
    monitoringSchedule: (signal.monitoringSchedule ?? []).map((item: AnyDoc, index: number) => ({
      question: item.question ?? '',
      frequency: item.frequency ?? 'daily',
      time: item.time ?? null,
      id: item.id ?? `mon-${index}`,
    })),
  }
}

export function toDoctorDTO(doctor: DoctorRow): AnyDoc {
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty ?? '',
    email: doctor.email,
    hospital: doctor.hospital_name ?? '',
  }
}

export function toPatientDTO(patient: PatientRow, extras: Record<string, unknown> = {}): AnyDoc {
  const data = patient.data ?? {}
  return {
    id: patient.client_id,
    doctorId: patient.doctor_id,
    name: data.name,
    age: data.age ?? 0,
    diagnosis: data.diagnosis ?? '',
    admittedDate: data.admittedDate ?? null,
    dischargedDate: data.dischargedDate ?? null,
    riskScore: data.riskScore ?? 'unmonitored',
    phoneNumber: data.phoneNumber,
    language: data.language ?? 'english',
    lastCheckIn: data.lastCheckIn ?? null,
    signal: normalizeSignal(data.signal),
    checkIns: [],
    alerts: [],
    notes: [],
    serverVersion: patient.server_version ?? 1,
    createdAt: iso(patient.created_at),
    updatedAt: iso(patient.updated_at),
    unresolvedAlertCount: patient.unresolved_alert_count ?? 0,
    aiStatus: data.signal ? (data.signal.approvedAt ? 'ready' : 'idle') : 'idle',
    ...extras,
  }
}

export function toAlertDTO(alert: AlertRow, patientClientId?: string | null): AnyDoc {
  const data = alert.data ?? {}
  return {
    id: alert.client_id,
    patientId: patientClientId ?? alert.patient_client_id ?? alert.patient_id,
    timestamp: data.timestamp ?? null,
    type: data.type,
    message: data.message,
    resolved: Boolean(data.resolved),
    resolvedAt: data.resolvedAt ?? null,
    severity: data.severity ?? (data.type === 'red_flag' ? 'critical' : 'warning'),
  }
}

export function toCheckInDTO(checkIn: CheckInRow, patientClientId?: string | null): AnyDoc {
  const data = checkIn.data ?? {}
  return {
    id: checkIn.client_id,
    patientId: patientClientId ?? checkIn.patient_client_id ?? checkIn.patient_id,
    timestamp: data.timestamp ?? null,
    message: data.message ?? '',
    riskScore: data.riskScore ?? 'green',
    triggeredFlags: Array.isArray(data.triggeredFlags) ? data.triggeredFlags : [],
    botResponse: data.botResponse ?? '',
    aiStatus: data.aiStatus ?? 'ready',
    provenance: data.provenance ?? null,
  }
}

export function toNoteDTO(note: NoteRow, patientClientId?: string | null): AnyDoc {
  const data = note.data ?? {}
  return {
    id: note.client_id,
    patientId: patientClientId ?? note.patient_client_id ?? note.patient_id,
    body: data.body ?? '',
    authorId: data.authorId ?? '',
    authorName: data.authorName ?? 'Clinician',
    createdAt: data.createdAt ?? iso(note.created_at),
  }
}

export function toAuditDTO(row: AuditRow): AnyDoc {
  return {
    id: row.id,
    timestamp: iso(row.timestamp),
    actor: row.actor,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? '',
    summary: row.summary,
    detail: row.detail ?? undefined,
    promptVersion: row.prompt_version ?? undefined,
    model: row.model ?? undefined,
    deviceId: row.device_id ?? undefined,
  }
}
