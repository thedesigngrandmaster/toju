// ─────────────────────────────────────────────────────────────────────────────
// Toju shared domain types.
// These types are intentionally identical in shape to the API DTOs so that the
// IndexedDB cache and the network layer can be used interchangeably.
// ─────────────────────────────────────────────────────────────────────────────

export type RiskScore = 'red' | 'yellow' | 'green' | 'unmonitored'
export type PatientLanguage = 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa'

/** How the UI should describe the local record's relationship with the server. */
export type SyncState = 'synced' | 'pending' | 'syncing' | 'conflict' | 'offline' | 'error'

/** Where a clinical or AI decision originated. */
export type AiSource = 'gemini' | 'offline-rule' | 'clinician' | 'server-fallback'

export interface AiProvenance {
  model: string
  promptVersion: string
  generatedAt: string
  source: AiSource
  confidence: number
}

export interface Medication {
  id: string
  name: string
  dose: string
  frequency: string
  status: 'continued' | 'started' | 'stopped' | 'adjusted'
  confidence: number
}

export interface MonitoringItem {
  id: string
  question: string
  frequency: 'daily' | 'weekly' | 'as_needed'
  time: string | null
}

export interface ClinicalSignal {
  patientSummary: string
  medications: Medication[]
  redFlags: string[]
  monitoringSchedule: MonitoringItem[]
  diagnosis: string
  rawNotes: string
  confidence: number
  approvedAt: string | null
  approvedBy?: string | null
  /** Versioned AI provenance — required for clinical audit. */
  provenance?: AiProvenance
}

export type AiStatus = 'idle' | 'queued' | 'processing' | 'ready' | 'error'

export type CheckIn = {
  id: string
  patientId: string
  timestamp: string
  message: string
  riskScore: RiskScore
  triggeredFlags: string[]
  botResponse: string
  /** Set when the check-in was classified locally and is awaiting cloud AI. */
  aiStatus?: AiStatus
  provenance?: AiProvenance
  syncState?: SyncState
}

export type AlertType = 'red_flag' | 'missed_checkin'

export type Alert = {
  id: string
  patientId: string
  timestamp: string
  type: AlertType
  message: string
  resolved: boolean
  resolvedAt?: string | null
  /** Severity drives queue priority: red alerts are never dropped. */
  severity?: 'critical' | 'warning'
  syncState?: SyncState
}

export type Note = {
  id: string
  patientId: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  syncState?: SyncState
}

/** A patient record as stored locally (single source of truth for the UI). */
export type Patient = {
  id: string
  doctorId: string
  name: string
  age: number
  diagnosis: string
  admittedDate: string
  dischargedDate: string
  riskScore: RiskScore
  phoneNumber: string
  language: PatientLanguage
  lastCheckIn: string | null
  signal: ClinicalSignal | null
  signalRawNotes?: string | null
  aiStatus: AiStatus
  createdAt: string
  updatedAt: string
  /** Server optimistic-concurrency version. */
  serverVersion: number
  syncState: SyncState
  /** True until the patient create operation has been acknowledged. */
  localOnly?: boolean
}

export type Doctor = {
  id: string
  name: string
  specialty: string
  email: string
  hospital: string
}

// ── Sync / queue ─────────────────────────────────────────────────────────────

export type EntityType = 'patient' | 'signal' | 'alert' | 'note' | 'checkin' | 'whatsapp'

export type OperationType =
  | 'patient.create'
  | 'patient.update'
  | 'patient.risk'
  | 'signal.approve'
  | 'alert.resolve'
  | 'note.create'
  | 'checkin.triage'
  | 'whatsapp.send'

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'conflict'

export interface OutboxOperation {
  id: string
  entityType: EntityType
  entityId: string
  op: OperationType
  payload: Record<string, unknown>
  baseVersion: number
  clientTimestamp: string
  createdAt: string
  status: OutboxStatus
  attempts: number
  lastError?: string
  nextAttemptAt: string
  /** Higher priority operations (RED alerts) are pushed first. */
  priority: number
}

export type AiJobKind = 'extract-signal' | 'triage'
export type AiJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface AiJob {
  id: string
  kind: AiJobKind
  patientId: string
  payload: Record<string, unknown>
  status: AiJobStatus
  attempts: number
  lastError?: string
  createdAt: string
  updatedAt: string
  nextAttemptAt: string
  provenance: AiProvenance
}

export interface AuditEntry {
  id: string
  timestamp: string
  actor: 'clinician' | 'system' | 'ai'
  action: string
  entityType: string
  entityId: string
  summary: string
  detail?: Record<string, unknown>
  promptVersion?: string
  model?: string
  deviceId?: string
}

export interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  detectedAt: string
  resolution: string
  localOperationId?: string
  serverVersion: number
  detail?: Record<string, unknown>
}

export interface SyncCursor {
  key: string
  value: string
}

// ── API DTOs ─────────────────────────────────────────────────────────────────

export interface PatientSummaryDTO {
  id: string
  name: string
  age: number
  diagnosis: string
  admittedDate: string
  dischargedDate: string
  doctorId: string
  riskScore: RiskScore
  phoneNumber: string
  language: PatientLanguage
  lastCheckIn: string | null
  signal: Pick<ClinicalSignal, 'approvedAt' | 'confidence' | 'diagnosis'> | null
  serverVersion?: number
  createdAt?: string
  updatedAt?: string
  unresolvedAlertCount?: number
  aiStatus?: AiStatus
}

export interface PatientDetailDTO extends PatientSummaryDTO {
  signal: ClinicalSignal | null
  checkIns: CheckIn[]
  alerts: Alert[]
  notes?: Note[]
}

export interface SyncPushOperation {
  id: string
  entityType: EntityType
  entityId: string
  op: OperationType
  payload: Record<string, unknown>
  baseVersion: number
  clientTimestamp: string
}

export interface SyncPushResult {
  id: string
  status: 'applied' | 'duplicate' | 'conflict' | 'retry' | 'rejected'
  serverVersion?: number
  conflictResolved?: boolean
  error?: string
  patient?: PatientDetailDTO
  alert?: Alert
  note?: Note
  checkIn?: CheckIn
}

export interface SyncPullResponse {
  serverTime: string
  patients: PatientDetailDTO[]
  alerts: Alert[]
  checkIns: CheckIn[]
  notes: Note[]
  /** Set when the response was truncated; client should pull again. */
  hasMore?: boolean
}

export interface ExtractSignalResponse {
  age: number
  patientSummary: string
  diagnosis: string
  medications: Omit<Medication, 'id'>[]
  redFlags: string[]
  monitoringSchedule: Omit<MonitoringItem, 'id'>[]
  confidence: number
  rawNotes: string
  approvedAt: null
  provenance: AiProvenance
}

export interface TriageResponse {
  riskScore: 'red' | 'yellow' | 'green'
  triggeredFlags: string[]
  botResponse: string
  provenance: AiProvenance
}

export interface WhatsAppStatus {
  ready: boolean
  state: string
  qr?: string | null
  pendingMessages: number
  failedMessages: number
  lastError?: string | null
}

export interface OutboundMessage {
  id: string
  phoneNumber: string
  body: string
  kind: 'welcome' | 'checkin' | 'triage-reply' | 'alert' | 'manual'
  priority: number
  status: 'pending' | 'sending' | 'sent' | 'failed'
  attempts: number
  lastError?: string | null
  createdAt: string
  sentAt?: string | null
  nextAttemptAt?: string
}
