import { Router } from 'express'
import { login, refresh, logout } from '../controllers/auth.controller'
import { getMe } from '../controllers/doctors.controller'
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  extractSignalHandler,
  approveSignalHandler,
  getSignal,
} from '../controllers/patients.controller'
import { getPatientProfile, submitCheckIn, listCheckIns } from '../controllers/checkin.controller'
import { listAlerts, resolveAlert } from '../controllers/alerts.controller'
import { dispatchCarePlan } from '../controllers/dispatch.controller'
import { requireAuth } from '../middleware/auth'
const router = Router()
router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)
router.get('/doctors/me', requireAuth, getMe)
router.get('/patients', requireAuth, listPatients)
router.post('/patients', requireAuth, createPatient)
router.get('/patients/:id', requireAuth, getPatient)
router.patch('/patients/:id', requireAuth, updatePatient)
router.post('/patients/:id/signal/extract', requireAuth, extractSignalHandler)
router.post('/patients/:id/signal/approve', requireAuth, approveSignalHandler)
router.get('/patients/:id/signal', requireAuth, getSignal)
router.get('/patient/:token', getPatientProfile)
router.post('/patient/:token/checkin', submitCheckIn)
router.get('/patients/:id/checkins', requireAuth, listCheckIns)
router.get('/alerts', requireAuth, listAlerts)
router.patch('/alerts/:id/resolve', requireAuth, resolveAlert)
router.post('/patients/:id/dispatch', requireAuth, dispatchCarePlan)
export default router
