import { Router } from 'express'
import { login, refresh, logout } from '../controllers/auth.controller'
import {
  listPatients,
  getPatient,
  createPatient,
  generateSignal,
  approveSignal,
  updateRiskScore,
} from '../controllers/patients.controller'
import { inboundCheckIn, listCheckIns } from '../controllers/checkin.controller'
import { listAlerts, resolveAlert } from '../controllers/alerts.controller'
import { requireAuth } from '../middleware/auth'

const router = Router()

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)

// ── Patients ──────────────────────────────────────────────────────────────────
router.get('/patients', requireAuth, listPatients)
router.get('/patients/:id', requireAuth, getPatient)
router.post('/patients', requireAuth, createPatient)
router.post('/patients/:id/signal', requireAuth, generateSignal)
router.patch('/patients/:id/signal/approve', requireAuth, approveSignal)
router.patch('/patients/:id/risk', requireAuth, updateRiskScore)

// ── Check-ins ─────────────────────────────────────────────────────────────────
router.post('/checkin/:token', inboundCheckIn)           // Twilio webhook (no auth)
router.get('/patients/:id/checkins', requireAuth, listCheckIns)

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get('/alerts', requireAuth, listAlerts)
router.patch('/alerts/:id/resolve', requireAuth, resolveAlert)

export default router
