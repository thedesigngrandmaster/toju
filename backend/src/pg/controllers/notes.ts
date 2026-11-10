import { Response } from 'express'
import crypto from 'crypto'
import type { AuthRequest } from '../../middleware/auth'
import { getDoctorById, getPatientRow, listNoteRows, recordAudit, upsertNote } from '../repo'
import { toNoteDTO } from '../dto'

export async function listNotes(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const notes = await listNoteRows(doctorId, patient.id, 200)
  res.json({ notes: notes.map((note) => toNoteDTO(note, patient.client_id)) })
}

export async function createNote(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (!body) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Note body is required' } })
    return
  }

  const patient = await getPatientRow(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const doctor = await getDoctorById(doctorId)
  const note = await upsertNote(doctorId, patient.id, crypto.randomUUID(), {
    body,
    authorId: doctorId,
    authorName: doctor?.name ?? 'Clinician',
    createdAt: new Date().toISOString(),
  })

  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'note.created',
    entityType: 'note',
    entityId: note.client_id,
    summary: `Added clinical note for ${patient.data?.name ?? 'patient'}`,
    detail: { patientId: patient.client_id, length: body.length },
  })

  res.status(201).json(toNoteDTO(note, patient.client_id))
}
