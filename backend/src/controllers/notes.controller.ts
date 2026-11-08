import { Response } from 'express'
import crypto from 'crypto'
import { Note } from '../models/Note'
import { Doctor } from '../models/Doctor'
import { recordAudit } from '../services/audit'
import { findPatientForDoctor, toNoteDTO } from '../services/serializers'
import type { AuthRequest } from '../middleware/auth'

export async function listNotes(req: AuthRequest, res: Response): Promise<void> {
  const patient = await findPatientForDoctor(req.doctorId as string, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const notes = await Note.find({ doctorId: req.doctorId, patientId: patient._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  res.json({ notes: notes.map((note) => toNoteDTO(note, patient.clientId)) })
}

export async function createNote(req: AuthRequest, res: Response): Promise<void> {
  const doctorId = req.doctorId as string
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (!body) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Note body is required' } })
    return
  }

  const patient = await findPatientForDoctor(doctorId, req.params.id)
  if (!patient) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Patient not found' } })
    return
  }

  const doctor = await Doctor.findById(doctorId).lean()
  const note = await Note.create({
    clientId: crypto.randomUUID(),
    patientId: patient._id,
    doctorId,
    authorId: doctorId,
    authorName: doctor?.name ?? 'Clinician',
    body,
  })

  await recordAudit({
    doctorId,
    actor: 'clinician',
    action: 'note.created',
    entityType: 'note',
    entityId: note.clientId,
    summary: `Added clinical note for ${patient.name}`,
    detail: { patientId: patient.clientId, length: body.length },
  })

  res.status(201).json(toNoteDTO(note.toObject(), patient.clientId))
}
