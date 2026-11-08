import { Router } from 'express'
import { login, refresh, logout, getMe } from '../controllers/auth.controller'
import {
  listPatients,
  getPatient,
  createPatient,
  generateSignal,
  approveSignal,
  updateRiskScore,
} from '../controllers/patients.controller'
import { listCheckIns } from '../controllers/checkin.controller'
import { listAlerts, resolveAlert } from '../controllers/alerts.controller'
import { push, pull } from '../controllers/sync.controller'
import { triage } from '../controllers/ai.controller'
import { listNotes, createNote } from '../controllers/notes.controller'
import { listAudit } from '../controllers/audit.controller'
import { status, qr, outbox, retry } from '../controllers/whatsapp.controller'
import { requireAuth } from '../middleware/auth'

const router: ReturnType<typeof Router> = Router()

// Auth
router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)
router.get('/doctors/me', requireAuth, getMe)

// Offline-first delta sync
router.post('/sync/push', requireAuth, push)
router.get('/sync/pull', requireAuth, pull)

// Patients
router.get('/patients', requireAuth, listPatients)
router.get('/patients/:id', requireAuth, getPatient)
router.post('/patients', requireAuth, createPatient)
router.post('/patients/:id/signal', requireAuth, generateSignal)
router.patch('/patients/:id/signal/approve', requireAuth, approveSignal)
router.patch('/patients/:id/risk', requireAuth, updateRiskScore)
router.get('/patients/:id/checkins', requireAuth, listCheckIns)
router.get('/patients/:id/notes', requireAuth, listNotes)
router.post('/patients/:id/notes', requireAuth, createNote)

// Alerts
router.get('/alerts', requireAuth, listAlerts)
router.patch('/alerts/:id/resolve', requireAuth, resolveAlert)

// AI triage (used by the durable client AI queue)
router.post('/ai/triage', requireAuth, triage)

// WhatsApp bridge + durable outbox
router.get('/whatsapp/status', requireAuth, status)
router.get('/whatsapp/qr', requireAuth, qr)
router.get('/whatsapp/outbox', requireAuth, outbox)
router.post('/whatsapp/outbox/:id/retry', requireAuth, retry)

// Server-side compliance audit trail
router.get('/audit', requireAuth, listAudit)

export default router
