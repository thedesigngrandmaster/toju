import { db, nowIso } from './db'
import { logAudit } from './audit'
import { uuid } from './utils'
import type {
  AiStatus,
  Alert,
  CheckIn,
  ClinicalSignal,
  ExtractSignalResponse,
  Note,
  OutboxOperation,
  OperationType,
  Patient,
  PatientLanguage,
  RiskScore,
  TriageResponse,
} from '@/types'

export interface NewPatientInput {
  name: string
  phoneNumber: string
  language: PatientLanguage
  age?: number
}

const RISK_PRIORITY: Record<RiskScore, number> = {
  red: 100,
  yellow: 40,
  green: 20,
  unmonitored: 10,
}

async function enqueue(input: {
  entityType: OutboxOperation['entityType']
  entityId: string
  op: OperationType
  payload: Record<string, unknown>
  baseVersion: number
  priority?: number
  clientTimestamp?: string
}): Promise<string> {
  const now = nowIso()
  const operation: OutboxOperation = {
    id: uuid(),
    entityType: input.entityType,
    entityId: input.entityId,
    op: input.op,
    payload: input.payload,
    baseVersion: input.baseVersion,
    clientTimestamp: input.clientTimestamp ?? now,
    createdAt: now,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    priority: input.priority ?? 20,
  }
  await db.outbox.add(operation)
  requestSyncWake()
  return operation.id
}

/**
 * Notify the app sync engine without importing it (avoids a dependency cycle).
 * The event is a no-op in the service worker, where the sync loop is driven by
 * the Background Sync event.
 */
function requestSyncWake(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toju:outbox-changed'))
  }
}

export async function createPatientLocal(input: NewPatientInput, doctorId: string): Promise<Patient> {
  const now = nowIso()
  const id = uuid()
  const patient: Patient = {
    id,
    doctorId,
    name: input.name.trim(),
    age: input.age ?? 0,
    diagnosis: 'Awaiting Signal',
    admittedDate: now.slice(0, 10),
    dischargedDate: now.slice(0, 10),
    riskScore: 'unmonitored',
    phoneNumber: input.phoneNumber.trim(),
    language: input.language,
    lastCheckIn: null,
    signal: null,
    signalRawNotes: null,
    aiStatus: 'idle',
    createdAt: now,
    updatedAt: now,
    serverVersion: 0,
    syncState: 'pending',
    localOnly: true,
  }

  await db.transaction('rw', [db.patients, db.outbox], async () => {
    await db.patients.add(patient)
    await enqueue({
      entityType: 'patient',
      entityId: id,
      op: 'patient.create',
      payload: {
        name: patient.name,
        phoneNumber: patient.phoneNumber,
        language: patient.language,
        age: patient.age,
      },
      baseVersion: 0,
      priority: 10,
      clientTimestamp: now,
    })
  })

  await logAudit({
    actor: 'clinician',
    action: 'patient.created',
    entityType: 'patient',
    entityId: id,
    summary: `Registered patient ${patient.name}`,
    detail: { phoneNumber: patient.phoneNumber, language: patient.language },
  })

  return patient
}

export async function updatePatientRisk(patientId: string, riskScore: RiskScore, doctorId: string): Promise<void> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error('Patient not found locally')

  await db.transaction('rw', [db.patients, db.outbox], async () => {
    await db.patients.update(patientId, {
      riskScore,
      updatedAt: nowIso(),
      syncState: 'pending',
    })
    await enqueue({
      entityType: 'patient',
      entityId: patientId,
      op: 'patient.risk',
      payload: { riskScore },
      baseVersion: patient.serverVersion,
      priority: RISK_PRIORITY[riskScore],
    })
  })

  await logAudit({
    actor: 'clinician',
    action: 'patient.risk_changed',
    entityType: 'patient',
    entityId: patientId,
    summary: `Risk manually set to ${riskScore}`,
    detail: { previous: patient.riskScore, next: riskScore, doctorId },
  })
}

export async function approveSignalLocal(
  patientId: string,
  signal: ClinicalSignal,
  doctorId: string,
): Promise<Patient> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error('Patient not found locally')

  const approvedAt = nowIso()
  const approvedSignal: ClinicalSignal = {
    ...signal,
    approvedAt,
    approvedBy: doctorId,
  }
  const updated: Patient = {
    ...patient,
    signal: approvedSignal,
    signalRawNotes: signal.rawNotes,
    diagnosis: signal.diagnosis || patient.diagnosis,
    age: patient.age || 0,
    riskScore: 'green',
    aiStatus: 'ready',
    updatedAt: approvedAt,
    syncState: 'pending',
  }

  await db.transaction('rw', [db.patients, db.outbox], async () => {
    await db.patients.put(updated)
    await enqueue({
      entityType: 'signal',
      entityId: patientId,
      op: 'signal.approve',
      payload: { signal: approvedSignal },
      baseVersion: patient.serverVersion,
      priority: 60,
      clientTimestamp: approvedAt,
    })
  })

  await logAudit({
    actor: 'clinician',
    action: 'signal.approved',
    entityType: 'patient',
    entityId: patientId,
    summary: `Approved care signal for ${patient.name}`,
    promptVersion: signal.provenance?.promptVersion,
    model: signal.provenance?.model,
    detail: {
      redFlags: signal.redFlags,
      medicationCount: signal.medications.length,
      monitoringCount: signal.monitoringSchedule.length,
    },
  })

  return updated
}

export async function resolveAlertLocal(alertId: string, doctorId: string): Promise<void> {
  const alert = await db.alerts.get(alertId)
  if (!alert || alert.resolved) return

  const resolvedAt = nowIso()
  const patient = await db.patients.get(alert.patientId)
  const nextRisk = await computeRiskAfterResolve(alert.patientId, alertId)

  await db.transaction('rw', [db.alerts, db.patients, db.outbox], async () => {
    await db.alerts.update(alertId, { resolved: true, resolvedAt, syncState: 'pending' })
    if (patient) {
      await db.patients.update(alert.patientId, {
        riskScore: nextRisk,
        updatedAt: resolvedAt,
        syncState: 'pending',
      })
    }
    await enqueue({
      entityType: 'alert',
      entityId: alertId,
      op: 'alert.resolve',
      payload: { resolvedAt },
      baseVersion: patient?.serverVersion ?? 1,
      priority: 30,
      clientTimestamp: resolvedAt,
    })
  })

  await logAudit({
    actor: 'clinician',
    action: 'alert.resolved',
    entityType: 'alert',
    entityId: alertId,
    summary: `Resolved alert for ${patient?.name ?? 'patient'}`,
    detail: { alertType: alert.type, message: alert.message, doctorId, nextRisk },
  })
}

async function computeRiskAfterResolve(patientId: string, resolvingAlertId: string): Promise<RiskScore> {
  const alerts = await db.alerts.where('patientId').equals(patientId).toArray()
  const remaining = alerts.filter((a) => a.id !== resolvingAlertId && !a.resolved)
  if (remaining.some((a) => a.type === 'red_flag')) return 'red'
  if (remaining.some((a) => a.type === 'missed_checkin')) return 'yellow'

  const checkIns = await db.checkIns.where('patientId').equals(patientId).reverse().sortBy('timestamp')
  const latest = checkIns[0]
  if (latest?.riskScore === 'red') return 'yellow'
  if (latest?.riskScore === 'yellow') return 'yellow'
  return 'green'
}

export async function addNoteLocal(
  patientId: string,
  body: string,
  author: { id: string; name: string },
): Promise<Note> {
  const now = nowIso()
  const note: Note = {
    id: uuid(),
    patientId,
    body: body.trim(),
    authorId: author.id,
    authorName: author.name,
    createdAt: now,
    syncState: 'pending',
  }
  const patient = await db.patients.get(patientId)

  await db.transaction('rw', [db.notes, db.outbox], async () => {
    await db.notes.add(note)
    await enqueue({
      entityType: 'note',
      entityId: note.id,
      op: 'note.create',
      payload: {
        patientId,
        body: note.body,
        authorId: author.id,
        authorName: author.name,
        createdAt: now,
      },
      baseVersion: patient?.serverVersion ?? 1,
      priority: 15,
      clientTimestamp: now,
    })
  })

  await logAudit({
    actor: 'clinician',
    action: 'note.created',
    entityType: 'note',
    entityId: note.id,
    summary: `Added clinical note for ${patient?.name ?? 'patient'}`,
    detail: { patientId, length: note.body.length },
  })

  return note
}

/**
 * Queues a clinician-authored WhatsApp message in the durable local outbox.
 * This works offline: the operation is pushed to the server, which owns the
 * actual WhatsApp delivery queue and retries with backoff.
 */
export async function queueWhatsAppMessageLocal(input: {
  phoneNumber: string
  body: string
  patientId?: string
  patientName?: string
}): Promise<string> {
  const now = nowIso()
  const phoneNumber = input.phoneNumber.replace(/[^\d+]/g, '')
  const operationId = await enqueue({
    entityType: 'whatsapp',
    // Always use a unique entity id so WhatsApp operations never masquerade as
    // pending edits to the patient entity during a pull merge.
    entityId: `wa-${uuid()}`,
    op: 'whatsapp.send',
    payload: {
      phoneNumber,
      body: input.body.trim(),
      kind: 'manual',
      patientId: input.patientId ?? null,
      patientName: input.patientName ?? null,
    },
    baseVersion: 1,
    priority: 35,
    clientTimestamp: now,
  })

  await logAudit({
    actor: 'clinician',
    action: 'whatsapp.message_queued',
    entityType: 'whatsapp',
    entityId: operationId,
    summary: `Queued WhatsApp message to ${input.patientName ?? phoneNumber}`,
    detail: { phoneNumber, length: input.body.trim().length, patientId: input.patientId ?? null },
  })

  return operationId
}

export interface TriageRecordInput {
  patient: Patient
  message: string
  result: TriageResponse
  /** True when the result came from offline rules and should be refined by AI. */
  refineWithAi: boolean
}

export async function recordTriageLocal(input: TriageRecordInput): Promise<{ checkIn: CheckIn; alert: Alert | null }> {
  const { patient, message, result } = input
  const now = nowIso()
  const checkIn: CheckIn = {
    id: uuid(),
    patientId: patient.id,
    timestamp: now,
    message,
    riskScore: result.riskScore,
    triggeredFlags: result.triggeredFlags,
    botResponse: result.botResponse,
    aiStatus: input.refineWithAi ? 'queued' : 'ready',
    provenance: result.provenance,
    syncState: 'pending',
  }

  let alert: Alert | null = null
  if (result.riskScore === 'red') {
    alert = {
      id: uuid(),
      patientId: patient.id,
      timestamp: now,
      type: 'red_flag',
      message: `RED alert${result.triggeredFlags.length ? `: ${result.triggeredFlags.join(', ')}` : ''} — "${message.slice(0, 160)}"`,
      resolved: false,
      resolvedAt: null,
      severity: 'critical',
      syncState: 'pending',
    }
  }

  const openAlerts = await db.alerts.where('patientId').equals(patient.id).toArray()
  const hasOpenRed = openAlerts.some((a) => !a.resolved && a.type === 'red_flag')
  const nextRisk: RiskScore =
    result.riskScore === 'red' || hasOpenRed
      ? 'red'
      : result.riskScore === 'yellow' || openAlerts.some((a) => !a.resolved && a.type === 'missed_checkin')
        ? 'yellow'
        : patient.riskScore === 'red' || patient.riskScore === 'yellow'
          ? patient.riskScore
          : 'green'

  await db.transaction('rw', [db.checkIns, db.alerts, db.patients, db.outbox], async () => {
    await db.checkIns.add(checkIn)
    if (alert) await db.alerts.add(alert)
    await db.patients.update(patient.id, {
      riskScore: nextRisk,
      lastCheckIn: now,
      updatedAt: now,
      syncState: 'pending',
    })
    await enqueue({
      entityType: 'checkin',
      entityId: checkIn.id,
      op: 'checkin.triage',
      payload: { checkIn, alert },
      baseVersion: patient.serverVersion,
      priority: result.riskScore === 'red' ? 100 : 25,
      clientTimestamp: now,
    })
  })

  await logAudit({
    actor: 'ai',
    action: 'triage.completed',
    entityType: 'checkin',
    entityId: checkIn.id,
    summary: `Triage classified patient message as ${result.riskScore.toUpperCase()}`,
    promptVersion: result.provenance.promptVersion,
    model: result.provenance.model,
    detail: {
      patientId: patient.id,
      riskScore: result.riskScore,
      triggeredFlags: result.triggeredFlags,
      source: result.provenance.source,
      message: message.slice(0, 280),
    },
  })

  return { checkIn, alert }
}

export async function applySignalExtraction(
  patientId: string,
  extracted: ExtractSignalResponse,
): Promise<ClinicalSignal> {
  const patient = await db.patients.get(patientId)
  if (!patient) throw new Error('Patient not found locally')

  const signal: ClinicalSignal = {
    patientSummary: extracted.patientSummary,
    diagnosis: extracted.diagnosis,
    medications: extracted.medications.map((med, index) => ({
      ...med,
      id: `med-${uuid()}-${index}`,
    })),
    monitoringSchedule: extracted.monitoringSchedule.map((item, index) => ({
      ...item,
      id: `mon-${uuid()}-${index}`,
    })),
    redFlags: extracted.redFlags,
    rawNotes: extracted.rawNotes,
    confidence: extracted.confidence,
    approvedAt: null,
    approvedBy: null,
    provenance: extracted.provenance,
  }

  await db.patients.update(patientId, {
    signal,
    signalRawNotes: extracted.rawNotes,
    diagnosis: extracted.diagnosis || patient.diagnosis,
    age: extracted.age > 0 ? extracted.age : patient.age,
    aiStatus: 'ready',
    updatedAt: nowIso(),
    syncState: 'pending',
  })

  await logAudit({
    actor: 'ai',
    action: 'signal.extracted',
    entityType: 'patient',
    entityId: patientId,
    summary: `AI extracted care signal for ${patient.name}`,
    promptVersion: extracted.provenance.promptVersion,
    model: extracted.provenance.model,
    detail: {
      diagnosis: extracted.diagnosis,
      medicationCount: extracted.medications.length,
      redFlags: extracted.redFlags,
      confidence: extracted.confidence,
    },
  })

  return signal
}

export async function setPatientAiStatus(patientId: string, aiStatus: AiStatus, error?: string): Promise<void> {
  const patch: Partial<Patient> = { aiStatus, updatedAt: nowIso() }
  await db.patients.update(patientId, patch)
  if (error) {
    await logAudit({
      actor: 'system',
      action: 'ai.error',
      entityType: 'patient',
      entityId: patientId,
      summary: `AI analysis failed: ${error}`,
    })
  }
}

export async function markCheckInAiReady(
  checkInId: string,
  result: TriageResponse,
): Promise<void> {
  const existing = await db.checkIns.get(checkInId)
  if (!existing) return
  await db.checkIns.update(checkInId, {
    aiStatus: 'ready',
    riskScore: existing.riskScore === 'red' ? 'red' : result.riskScore,
    triggeredFlags: [...new Set([...existing.triggeredFlags, ...result.triggeredFlags])],
    botResponse: existing.botResponse || result.botResponse,
    provenance: result.provenance,
  })
}

/**
 * Re-queues a triage record after a cloud AI refinement (for example, the
 * offline rules said GREEN but Gemini identified a RED flag). The check-in id is
 * stable, so the server upserts instead of duplicating.
 */
export async function queueTriageUpdate(
  patient: Patient,
  checkIn: CheckIn,
  alert: Alert | null,
): Promise<void> {
  await db.transaction('rw', [db.patients, db.outbox], async () => {
    await enqueue({
      entityType: 'checkin',
      entityId: checkIn.id,
      op: 'checkin.triage',
      payload: { checkIn, alert },
      baseVersion: patient.serverVersion,
      priority: checkIn.riskScore === 'red' || alert ? 100 : 25,
      clientTimestamp: checkIn.timestamp,
    })
  })
}

export async function getPatientLocal(id: string): Promise<Patient | undefined> {
  return db.patients.get(id)
}

export async function listPatientsLocal(doctorId: string): Promise<Patient[]> {
  return db.patients.where('doctorId').equals(doctorId).toArray()
}

export async function getLocalAuditCount(): Promise<number> {
  return db.audit.count()
}

export async function clearOutboxForTests(): Promise<void> {
  await db.outbox.clear()
}
