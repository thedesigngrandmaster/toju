import { Router } from 'express'
import { getMe, login, logout, refresh } from './controllers/auth'
import {
  approveSignal,
  createPatient,
  generateSignal,
  getPatient,
  listPatients,
  updateRiskScore,
} from './controllers/patients'
import { listCheckIns } from './controllers/checkins'
import { listAlerts, resolveAlert } from './controllers/alerts'
import { pull, push } from './controllers/sync'
import { triage } from './controllers/ai'
import { createNote, listNotes } from './controllers/notes'
import { listAudit } from './controllers/audit'
import { outbox, qr, retry, status } from './controllers/whatsapp'
import { requireAuth } from '../middleware/auth'

const router: ReturnType<typeof Router> = Router()

router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)
router.get('/doctors/me', requireAuth, getMe)

router.post('/sync/push', requireAuth, push)
router.get('/sync/pull', requireAuth, pull)

router.get('/patients', requireAuth, listPatients)
router.get('/patients/:id', requireAuth, getPatient)
router.post('/patients', requireAuth, createPatient)
router.post('/patients/:id/signal', requireAuth, generateSignal)
router.patch('/patients/:id/signal/approve', requireAuth, approveSignal)
router.patch('/patients/:id/risk', requireAuth, updateRiskScore)
router.get('/patients/:id/checkins', requireAuth, listCheckIns)
router.get('/patients/:id/notes', requireAuth, listNotes)
router.post('/patients/:id/notes', requireAuth, createNote)

router.get('/alerts', requireAuth, listAlerts)
router.patch('/alerts/:id/resolve', requireAuth, resolveAlert)

router.post('/ai/triage', requireAuth, triage)

router.get('/whatsapp/status', requireAuth, status)
router.get('/whatsapp/qr', requireAuth, qr)
router.get('/whatsapp/outbox', requireAuth, outbox)
router.post('/whatsapp/outbox/:id/retry', requireAuth, retry)

router.get('/audit', requireAuth, listAudit)

export default router
