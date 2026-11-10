/* eslint-disable @typescript-eslint/no-explicit-any */
import { execute, query, queryOne } from './db'
import type {
  AlertRow,
  AuditRow,
  CheckInRow,
  DoctorRow,
  HospitalRow,
  NoteRow,
  OutboundRow,
  PatientRow,
  SyncOperationRow,
} from './dto'

type AnyDoc = Record<string, any>

export interface AuditInput {
  doctorId: string
  actor: 'clinician' | 'system' | 'ai'
  action: string
  entityType: string
  entityId: string
  summary: string
  detail?: Record<string, unknown>
  promptVersion?: string
  model?: string
  deviceId?: string
  timestamp?: Date
}

export interface EnqueueOutboundInput {
  idempotencyKey: string
  doctorId: string
  patientId?: string | null
  phoneNumber: string
  body: string
  kind: 'welcome' | 'checkin' | 'triage-reply' | 'alert' | 'manual'
  priority?: number
  nextAttemptAt?: Date
}

export async function getDoctorById(id: string): Promise<DoctorRow | null> {
  return queryOne<DoctorRow>(
    `SELECT d.*, h.name AS hospital_name
       FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
      WHERE d.id = $1
      LIMIT 1`,
    [id],
  )
}

export async function getDoctorByEmail(email: string): Promise<DoctorRow | null> {
  return queryOne<DoctorRow>(
    `SELECT d.*, h.name AS hospital_name
       FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
      WHERE lower(d.email) = lower($1)
      LIMIT 1`,
    [email],
  )
}

export async function getDoctorByRefreshHash(hash: string): Promise<DoctorRow | null> {
  return queryOne<DoctorRow>(
    `SELECT d.*, h.name AS hospital_name
       FROM doctors d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
      WHERE d.refresh_token_hash = $1
      LIMIT 1`,
    [hash],
  )
}

export async function updateDoctorRefreshHash(id: string, hash: string | null): Promise<void> {
  await execute(
    `UPDATE doctors SET refresh_token_hash = $2, updated_at = now() WHERE id = $1`,
    [id, hash],
  )
}

export async function getHospitalById(id: string): Promise<HospitalRow | null> {
  return queryOne<HospitalRow>(`SELECT * FROM hospitals WHERE id = $1 LIMIT 1`, [id])
}

export async function countPatientsByRisk(doctorId: string): Promise<Record<string, number>> {
  const rows = await query<{ risk: string; count: string }>(
    `SELECT COALESCE(data->>'riskScore', 'unmonitored') AS risk, count(*)::text AS count
       FROM patients
      WHERE doctor_id = $1
      GROUP BY 1`,
    [doctorId],
  )
  const counts: Record<string, number> = { total: 0, red: 0, yellow: 0, green: 0, unmonitored: 0 }
  for (const row of rows) {
    const count = Number(row.count)
    if (row.risk in counts) counts[row.risk] = count
    counts.total += count
  }
  return counts
}

export async function listPatientRows(
  doctorId: string,
  options: { riskScore?: string; search?: string; page: number; limit: number },
): Promise<PatientRow[]> {
  const params: unknown[] = [doctorId]
  const clauses = ['p.doctor_id = $1']
  if (options.riskScore) {
    params.push(options.riskScore)
    clauses.push(`p.data->>'riskScore' = $${params.length}`)
  }
  if (options.search) {
    params.push(`%${options.search}%`)
    clauses.push(`p.data->>'name' ILIKE $${params.length}`)
  }
  params.push(options.limit, (options.page - 1) * options.limit)
  return query<PatientRow>(
    `SELECT p.*, COALESCE(a.unresolved, 0)::int AS unresolved_alert_count
       FROM patients p
       LEFT JOIN (
         SELECT patient_id, count(*) AS unresolved
           FROM alerts
          WHERE COALESCE((data->>'resolved')::boolean, false) = false
          GROUP BY patient_id
       ) a ON a.patient_id = p.id
      WHERE ${clauses.join(' AND ')}
      ORDER BY
        CASE p.data->>'riskScore'
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          WHEN 'green' THEN 3
          ELSE 4
        END,
        p.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )
}

export async function countPatientRows(
  doctorId: string,
  options: { riskScore?: string; search?: string },
): Promise<number> {
  const params: unknown[] = [doctorId]
  const clauses = ['doctor_id = $1']
  if (options.riskScore) {
    params.push(options.riskScore)
    clauses.push(`data->>'riskScore' = $${params.length}`)
  }
  if (options.search) {
    params.push(`%${options.search}%`)
    clauses.push(`data->>'name' ILIKE $${params.length}`)
  }
  const row = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM patients WHERE ${clauses.join(' AND ')}`,
    params,
  )
  return Number(row?.count ?? 0)
}

export async function getPatientRow(doctorId: string, id: string): Promise<PatientRow | null> {
  return queryOne<PatientRow>(
    `SELECT * FROM patients
      WHERE doctor_id = $1 AND (client_id = $2 OR id::text = $2)
      LIMIT 1`,
    [doctorId, id],
  )
}

export async function getPatientByClientId(doctorId: string, clientId: string): Promise<PatientRow | null> {
  return queryOne<PatientRow>(
    `SELECT * FROM patients WHERE doctor_id = $1 AND client_id = $2 LIMIT 1`,
    [doctorId, clientId],
  )
}

export async function insertPatientRow(
  doctorId: string,
  hospitalId: string | null,
  clientId: string,
  data: AnyDoc,
): Promise<PatientRow> {
  const rows = await query<PatientRow>(
    `INSERT INTO patients (client_id, doctor_id, hospital_id, data, server_version)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [clientId, doctorId, hospitalId, data],
  )
  return rows[0]
}

export async function updatePatientData(id: string, data: AnyDoc): Promise<PatientRow | null> {
  return queryOne<PatientRow>(
    `UPDATE patients
        SET data = $2, server_version = server_version + 1, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, data],
  )
}

export async function getPatientClientIdMap(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await query<{ id: string; client_id: string }>(
    `SELECT id, client_id FROM patients WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((row) => [row.id, row.client_id]))
}

export async function getAlertRow(doctorId: string, id: string): Promise<AlertRow | null> {
  return queryOne<AlertRow>(
    `SELECT * FROM alerts
      WHERE doctor_id = $1 AND (client_id = $2 OR id::text = $2)
      LIMIT 1`,
    [doctorId, id],
  )
}

export async function getAlertByClientId(doctorId: string, clientId: string): Promise<AlertRow | null> {
  return queryOne<AlertRow>(
    `SELECT * FROM alerts WHERE doctor_id = $1 AND client_id = $2 LIMIT 1`,
    [doctorId, clientId],
  )
}

export async function upsertAlert(
  doctorId: string,
  patientId: string | null,
  clientId: string,
  data: AnyDoc,
): Promise<AlertRow> {
  const existing = await getAlertByClientId(doctorId, clientId)
  if (existing) {
    const merged = { ...(existing.data ?? {}), ...data }
    const rows = await query<AlertRow>(
      `UPDATE alerts
          SET patient_id = $2, data = $3, server_version = server_version + 1, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [existing.id, patientId, merged],
    )
    return rows[0]
  }
  const rows = await query<AlertRow>(
    `INSERT INTO alerts (client_id, doctor_id, patient_id, data, server_version)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [clientId, doctorId, patientId, data],
  )
  return rows[0]
}

export async function updateAlertData(id: string, data: AnyDoc): Promise<AlertRow | null> {
  return queryOne<AlertRow>(
    `UPDATE alerts
        SET data = $2, server_version = server_version + 1, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, data],
  )
}

export async function listAlertRows(doctorId: string, unresolved = false): Promise<AlertRow[]> {
  return query<AlertRow>(
    `SELECT a.*, p.client_id AS patient_client_id, p.data->>'name' AS patient_name
       FROM alerts a
       LEFT JOIN patients p ON p.id = a.patient_id
      WHERE a.doctor_id = $1
        AND ($2::boolean = false OR COALESCE((a.data->>'resolved')::boolean, false) = false)
      ORDER BY (a.data->>'timestamp') DESC NULLS LAST, a.created_at DESC`,
    [doctorId, unresolved],
  )
}

export async function upsertCheckIn(
  doctorId: string,
  patientId: string,
  clientId: string,
  data: AnyDoc,
): Promise<CheckInRow> {
  const existing = await queryOne<CheckInRow>(
    `SELECT * FROM check_ins WHERE doctor_id = $1 AND client_id = $2 LIMIT 1`,
    [doctorId, clientId],
  )
  if (existing) {
    const merged = { ...(existing.data ?? {}), ...data }
    const rows = await query<CheckInRow>(
      `UPDATE check_ins
          SET patient_id = $2, data = $3, server_version = server_version + 1, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [existing.id, patientId, merged],
    )
    return rows[0]
  }
  const rows = await query<CheckInRow>(
    `INSERT INTO check_ins (client_id, doctor_id, patient_id, data, server_version)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [clientId, doctorId, patientId, data],
  )
  return rows[0]
}

export async function listCheckInRows(patientId: string, limit = 200): Promise<CheckInRow[]> {
  return query<CheckInRow>(
    `SELECT * FROM check_ins
      WHERE patient_id = $1
      ORDER BY (data->>'timestamp') DESC NULLS LAST, created_at DESC
      LIMIT $2`,
    [patientId, limit],
  )
}

export async function getNoteByClientId(doctorId: string, clientId: string): Promise<NoteRow | null> {
  return queryOne<NoteRow>(
    `SELECT * FROM notes WHERE doctor_id = $1 AND client_id = $2 LIMIT 1`,
    [doctorId, clientId],
  )
}

export async function upsertNote(
  doctorId: string,
  patientId: string,
  clientId: string,
  data: AnyDoc,
): Promise<NoteRow> {
  const existing = await getNoteByClientId(doctorId, clientId)
  if (existing) {
    const merged = { ...(existing.data ?? {}), ...data }
    const rows = await query<NoteRow>(
      `UPDATE notes
          SET patient_id = $2, data = $3, server_version = server_version + 1, updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [existing.id, patientId, merged],
    )
    return rows[0]
  }
  const rows = await query<NoteRow>(
    `INSERT INTO notes (client_id, doctor_id, patient_id, data, server_version)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING *`,
    [clientId, doctorId, patientId, data],
  )
  return rows[0]
}

export async function listNoteRows(doctorId: string, patientId: string, limit = 200): Promise<NoteRow[]> {
  return query<NoteRow>(
    `SELECT * FROM notes
      WHERE doctor_id = $1 AND patient_id = $2
      ORDER BY (data->>'createdAt') DESC NULLS LAST, created_at DESC
      LIMIT $3`,
    [doctorId, patientId, limit],
  )
}

export async function getSyncOperation(
  doctorId: string,
  operationId: string,
): Promise<SyncOperationRow | null> {
  return queryOne<SyncOperationRow>(
    `SELECT * FROM sync_operations WHERE doctor_id = $1 AND operation_id = $2 LIMIT 1`,
    [doctorId, operationId],
  )
}

export async function insertSyncOperation(input: {
  operationId: string
  doctorId: string
  deviceId: string
  entityType: string
  entityId: string
  op: string
  status: string
  result: AnyDoc
  error?: string | null
}): Promise<SyncOperationRow | null> {
  return queryOne<SyncOperationRow>(
    `INSERT INTO sync_operations
       (operation_id, doctor_id, device_id, entity_type, entity_id, op, status, result, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (doctor_id, operation_id) DO NOTHING
     RETURNING *`,
    [
      input.operationId,
      input.doctorId,
      input.deviceId,
      input.entityType,
      input.entityId,
      input.op,
      input.status,
      input.result,
      input.error ?? null,
    ],
  )
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs
         (doctor_id, actor, action, entity_type, entity_id, summary, detail, prompt_version, model, device_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.doctorId,
        input.actor,
        input.action,
        input.entityType,
        input.entityId,
        input.summary,
        input.detail ?? null,
        input.promptVersion ?? null,
        input.model ?? null,
        input.deviceId ?? null,
        input.timestamp ?? new Date(),
      ],
    )
  } catch (error) {
    console.error('[AUDIT] Failed to persist audit entry:', error)
  }
}

export async function listAuditRows(
  doctorId: string,
  filter: { actor?: string; entityId?: string; limit: number },
): Promise<AuditRow[]> {
  const params: unknown[] = [doctorId]
  const clauses = ['doctor_id = $1']
  if (filter.actor) {
    params.push(filter.actor)
    clauses.push(`actor = $${params.length}`)
  }
  if (filter.entityId) {
    params.push(filter.entityId)
    clauses.push(`entity_id = $${params.length}`)
  }
  params.push(filter.limit)
  return query<AuditRow>(
    `SELECT * FROM audit_logs
      WHERE ${clauses.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${params.length}`,
    params,
  )
}

export async function enqueueOutbound(input: EnqueueOutboundInput): Promise<void> {
  const priority =
    input.priority ?? (input.kind === 'alert' || input.kind === 'triage-reply' ? 100 : 20)
  await execute(
    `INSERT INTO outbound_messages
       (idempotency_key, doctor_id, patient_id, phone_number, body, kind, priority, status, attempts, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, $8)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      input.idempotencyKey,
      input.doctorId,
      input.patientId ?? null,
      input.phoneNumber,
      input.body,
      input.kind,
      priority,
      input.nextAttemptAt ?? new Date(),
    ],
  )
}

export async function outboxCounts(): Promise<{
  pendingMessages: number
  failedMessages: number
  lastError: string | null
}> {
  const row = await queryOne<{ pending: string; failed: string; last_error: string | null }>(
    `SELECT
       count(*) FILTER (WHERE status IN ('pending', 'sending'))::text AS pending,
       count(*) FILTER (WHERE status = 'failed')::text AS failed,
       (SELECT last_error FROM outbound_messages WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 1) AS last_error
     FROM outbound_messages`,
  )
  return {
    pendingMessages: Number(row?.pending ?? 0),
    failedMessages: Number(row?.failed ?? 0),
    lastError: row?.last_error ?? null,
  }
}

export async function listOutboundRows(doctorId: string, limit = 100): Promise<OutboundRow[]> {
  return query<OutboundRow>(
    `SELECT * FROM outbound_messages
      WHERE doctor_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [doctorId, limit],
  )
}

export async function retryOutbound(id: string): Promise<boolean> {
  const count = await execute(
    `UPDATE outbound_messages
        SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, updated_at = now()
      WHERE id::text = $1 OR idempotency_key = $1`,
    [id],
  )
  return count > 0
}

export async function recomputePatientRisk(patientId: string): Promise<'red' | 'yellow' | 'green'> {
  const alerts = await query<{ type: string }>(
    `SELECT data->>'type' AS type
       FROM alerts
      WHERE patient_id = $1
        AND COALESCE((data->>'resolved')::boolean, false) = false`,
    [patientId],
  )
  const latest = await queryOne<CheckInRow>(
    `SELECT * FROM check_ins
      WHERE patient_id = $1
      ORDER BY (data->>'timestamp') DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [patientId],
  )

  let nextRisk: 'red' | 'yellow' | 'green' = 'green'
  if (alerts.some((alert) => alert.type === 'red_flag')) nextRisk = 'red'
  else if (alerts.some((alert) => alert.type === 'missed_checkin')) nextRisk = 'yellow'
  else if (latest?.data?.riskScore === 'red' || latest?.data?.riskScore === 'yellow') nextRisk = 'yellow'

  await execute(
    `UPDATE patients
        SET data = jsonb_set(data, '{riskScore}', to_jsonb($2::text)),
            server_version = server_version + 1,
            updated_at = now()
      WHERE id = $1`,
    [patientId, nextRisk],
  )
  return nextRisk
}
