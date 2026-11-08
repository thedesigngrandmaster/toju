import { api, ApiError } from './api'
import { db, nowIso } from './db'
import { isOnline } from './network'
import { logAudit } from './audit'
import { offlineTriage } from './triage'
import {
  applySignalExtraction,
  getPatientLocal,
  markCheckInAiReady,
  queueTriageUpdate,
  recordTriageLocal,
  setPatientAiStatus,
} from './repository'
import { uuid } from './utils'
import type {
  AiJob,
  AiProvenance,
  Alert,
  CheckIn,
  ClinicalSignal,
  Patient,
  TriageResponse,
} from '@/types'

export const CLOUD_MODEL = 'gemini-2.5-flash'
export const SIGNAL_PROMPT_VERSION = 'signal-extraction@2.1.0'
export const TRIAGE_PROMPT_VERSION = 'triage-context@2.1.0'

const RETRY_BASE_MS = 10_000

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 0) return true
    if (error.status === 408 || error.status === 429) return true
    if (error.status >= 500) return true
    return false
  }
  return true
}

function backoff(attempts: number): string {
  return new Date(Date.now() + Math.min(10 * 60_000, RETRY_BASE_MS * 2 ** Math.min(attempts, 5))).toISOString()
}

function cloudProvenance(promptVersion: string, confidence = 0.9): AiProvenance {
  return {
    model: CLOUD_MODEL,
    promptVersion,
    generatedAt: nowIso(),
    source: 'gemini',
    confidence,
  }
}

async function queueAiJob(
  kind: AiJob['kind'],
  patientId: string,
  payload: Record<string, unknown>,
  promptVersion: string,
): Promise<AiJob> {
  const now = nowIso()
  const job: AiJob = {
    id: uuid(),
    kind,
    patientId,
    payload,
    status: 'queued',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    provenance: cloudProvenance(promptVersion, 0),
  }
  await db.aiQueue.add(job)
  await logAudit({
    actor: 'system',
    action: 'ai.queued',
    entityType: kind === 'extract-signal' ? 'patient' : 'checkin',
    entityId: patientId,
    summary: `${kind === 'extract-signal' ? 'Signal extraction' : 'Triage'} queued for AI analysis`,
    promptVersion,
    model: CLOUD_MODEL,
  })
  return job
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal extraction
// ─────────────────────────────────────────────────────────────────────────────

export type SignalExtractionOutcome =
  | { queued: true; jobId: string }
  | { queued: false; signal: ClinicalSignal }

export async function requestSignalExtraction(
  patientId: string,
  rawNotes: string,
): Promise<SignalExtractionOutcome> {
  const patient = await getPatientLocal(patientId)
  if (!patient) throw new Error('Patient not found locally')

  // Preserve the notes immediately, even if the network never returns.
  await db.patients.update(patientId, {
    signalRawNotes: rawNotes,
    aiStatus: 'processing',
    updatedAt: nowIso(),
  })

  if (isOnline()) {
    try {
      const extracted = await api.patients.generateSignal(patientId, rawNotes)
      const signal = await applySignalExtraction(patientId, extracted)
      return { queued: false, signal }
    } catch (error) {
      if (!isRetryable(error)) {
        await setPatientAiStatus(
          patientId,
          'error',
          error instanceof Error ? error.message : 'Signal extraction failed',
        )
        throw error
      }
      // Fall through to the durable queue.
    }
  }

  const job = await queueAiJob('extract-signal', patientId, { rawNotes }, SIGNAL_PROMPT_VERSION)
  await setPatientAiStatus(patientId, 'queued')
  return { queued: true, jobId: job.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Triage
// ─────────────────────────────────────────────────────────────────────────────

export interface TriageOutcome {
  checkIn: CheckIn
  alert: Alert | null
  queued: boolean
  refinedByCloud: boolean
}

const RISK_RANK = { green: 0, yellow: 1, red: 2, unmonitored: 0 } as const

/**
 * Runs local rules instantly, persists the result, then refines with Gemini if
 * connectivity allows. Local RED is never downgraded. Cloud RED always upgrades
 * and creates a durable alert.
 */
export async function triagePatientMessage(patient: Patient, message: string): Promise<TriageOutcome> {
  const localResult = offlineTriage(
    message,
    patient.signal?.redFlags ?? [],
    patient.language,
  )

  const local = await recordTriageLocal({
    patient,
    message,
    result: localResult,
    refineWithAi: true,
  })

  if (!isOnline()) {
    await queueAiJob(
      'triage',
      patient.id,
      { message, checkInId: local.checkIn.id },
      TRIAGE_PROMPT_VERSION,
    )
    return { checkIn: local.checkIn, alert: local.alert, queued: true, refinedByCloud: false }
  }

  try {
    const cloud = await api.ai.triage({
      patientId: patient.id,
      message,
      language: patient.language,
      localRisk: localResult.riskScore,
      localFlags: localResult.triggeredFlags,
    })
    const reconciled = await reconcileCloudTriage(patient.id, local.checkIn.id, cloud)
    return {
      checkIn: reconciled.checkIn,
      alert: reconciled.alert,
      queued: false,
      refinedByCloud: true,
    }
  } catch (error) {
    if (isRetryable(error)) {
      await queueAiJob(
        'triage',
        patient.id,
        { message, checkInId: local.checkIn.id },
        TRIAGE_PROMPT_VERSION,
      )
      return { checkIn: local.checkIn, alert: local.alert, queued: true, refinedByCloud: false }
    }
    await logAudit({
      actor: 'system',
      action: 'triage.cloud_rejected',
      entityType: 'checkin',
      entityId: local.checkIn.id,
      summary: error instanceof Error ? error.message : 'Cloud triage rejected',
    })
    return { checkIn: local.checkIn, alert: local.alert, queued: false, refinedByCloud: false }
  }
}

async function reconcileCloudTriage(
  patientId: string,
  checkInId: string,
  cloud: TriageResponse,
): Promise<{ checkIn: CheckIn; alert: Alert | null }> {
  const patient = await db.patients.get(patientId)
  const existing = await db.checkIns.get(checkInId)
  if (!patient || !existing) throw new Error('Local triage record missing')

  const localRank = RISK_RANK[existing.riskScore] ?? 0
  const cloudRank = RISK_RANK[cloud.riskScore] ?? 0
  const chosenRisk = cloudRank > localRank ? cloud.riskScore : existing.riskScore
  const chosenProvenance = cloudRank > localRank ? cloud.provenance : existing.provenance
  const mergedFlags = [...new Set([...existing.triggeredFlags, ...cloud.triggeredFlags])]

  const openRed = await db.alerts
    .where('patientId')
    .equals(patientId)
    .filter((alert) => !alert.resolved && alert.type === 'red_flag')
    .first()

  let alert: Alert | null = null
  if (chosenRisk === 'red' && !openRed) {
    alert = {
      id: uuid(),
      patientId,
      timestamp: nowIso(),
      type: 'red_flag',
      message: `RED alert from AI triage${mergedFlags.length ? `: ${mergedFlags.join(', ')}` : ''} — "${existing.message.slice(0, 160)}"`,
      resolved: false,
      resolvedAt: null,
      severity: 'critical',
      syncState: 'pending',
    }
  }

  const chosenCheckIn: CheckIn = {
    ...existing,
    riskScore: chosenRisk,
    triggeredFlags: mergedFlags,
    provenance: chosenProvenance,
    aiStatus: 'ready',
    syncState: 'pending',
  }

  await db.transaction('rw', [db.checkIns, db.alerts, db.patients], async () => {
    await db.checkIns.put(chosenCheckIn)
    if (alert) await db.alerts.add(alert)
    const nextPatientRisk =
      chosenRisk === 'red' || patient.riskScore === 'red'
        ? 'red'
        : chosenRisk === 'yellow' || patient.riskScore === 'yellow'
          ? 'yellow'
          : patient.riskScore
    await db.patients.update(patientId, {
      riskScore: nextPatientRisk,
      updatedAt: nowIso(),
      syncState: 'pending',
    })
  })

  await logAudit({
    actor: 'ai',
    action: 'triage.refined',
    entityType: 'checkin',
    entityId: checkInId,
    summary: `Cloud AI refined triage: local=${existing.riskScore}, cloud=${cloud.riskScore}, final=${chosenRisk}`,
    promptVersion: cloud.provenance.promptVersion,
    model: cloud.provenance.model,
    detail: {
      cloudFlags: cloud.triggeredFlags,
      localFlags: existing.triggeredFlags,
      cloudSource: cloud.provenance.source,
      disagreement: cloud.riskScore !== existing.riskScore,
    },
  })

  if (chosenRisk !== existing.riskScore || alert) {
    await queueTriageUpdate(patient, chosenCheckIn, alert)
  }

  return { checkIn: chosenCheckIn, alert }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue processing
// ─────────────────────────────────────────────────────────────────────────────

export interface AiQueueReport {
  processed: number
  failed: number
  remaining: number
}

/**
 * Processes queued AI jobs strictly in creation order. A network failure stops
 * the loop so we do not hammer the API; the job remains durable in IndexedDB.
 */
export async function processAiQueue(): Promise<AiQueueReport> {
  if (!isOnline()) {
    return { processed: 0, failed: 0, remaining: await db.aiQueue.where('status').equals('queued').count() }
  }

  const jobs = await db.aiQueue.orderBy('createdAt').toArray()
  const due = jobs.filter(
    (job) => (job.status === 'queued') && job.nextAttemptAt <= nowIso(),
  )

  let processed = 0
  let failed = 0

  for (const job of due) {
    await db.aiQueue.update(job.id, { status: 'running', updatedAt: nowIso() })
    try {
      if (job.kind === 'extract-signal') {
        const rawNotes = String(job.payload.rawNotes ?? '')
        const extracted = await api.patients.generateSignal(job.patientId, rawNotes)
        await applySignalExtraction(job.patientId, extracted)
      } else {
        const message = String(job.payload.message ?? '')
        const patient = await db.patients.get(job.patientId)
        if (!patient) throw new Error('Patient no longer exists locally')
        const checkInId = String(job.payload.checkInId ?? '')
        const cloud = await api.ai.triage({
          patientId: job.patientId,
          message,
          language: patient.language,
        })
        if (checkInId) {
          await reconcileCloudTriage(job.patientId, checkInId, cloud)
        } else {
          await markCheckInAiReady(checkInId, cloud)
        }
      }

      await db.aiQueue.update(job.id, {
        status: 'done',
        updatedAt: nowIso(),
        lastError: undefined,
      })
      processed += 1
    } catch (error) {
      const attempts = job.attempts + 1
      const retryable = isRetryable(error)
      if (retryable && attempts < 8) {
        await db.aiQueue.update(job.id, {
          status: 'queued',
          attempts,
          updatedAt: nowIso(),
          lastError: error instanceof Error ? error.message : 'AI request failed',
          nextAttemptAt: backoff(attempts),
        })
        if (job.kind === 'extract-signal') {
          await setPatientAiStatus(job.patientId, 'queued')
        }
        // Stop the ordered queue on connectivity/server failures.
        break
      }
      await db.aiQueue.update(job.id, {
        status: 'failed',
        attempts,
        updatedAt: nowIso(),
        lastError: error instanceof Error ? error.message : 'AI request failed',
      })
      if (job.kind === 'extract-signal') {
        await setPatientAiStatus(
          job.patientId,
          'error',
          error instanceof Error ? error.message : 'AI analysis failed',
        )
      }
      await logAudit({
        actor: 'system',
        action: 'ai.failed',
        entityType: job.kind === 'extract-signal' ? 'patient' : 'checkin',
        entityId: job.patientId,
        summary: `AI job failed permanently: ${error instanceof Error ? error.message : 'unknown'}`,
        promptVersion: job.provenance.promptVersion,
        model: job.provenance.model,
      })
      failed += 1
    }
  }

  const remaining = await db.aiQueue.where('status').equals('queued').count()
  return { processed, failed, remaining }
}

export async function pendingAiCount(): Promise<number> {
  return db.aiQueue.where('status').equals('queued').count()
}
