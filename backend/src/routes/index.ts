import { Router, Request, Response } from 'express'
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
import { requireAuth } from '../middleware/auth'
import { getLatestQr, isWhatsAppReady } from '../services/whatsapp'
import QRCode from 'qrcode'

const router: ReturnType<typeof Router> = Router()

router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/logout', logout)
router.get('/doctors/me', requireAuth, getMe)

router.get('/patients', requireAuth, listPatients)
router.get('/patients/:id', requireAuth, getPatient)
router.post('/patients', requireAuth, createPatient)
router.post('/patients/:id/signal', requireAuth, generateSignal)
router.patch('/patients/:id/signal/approve', requireAuth, approveSignal)
router.patch('/patients/:id/risk', requireAuth, updateRiskScore)

router.get('/patients/:id/checkins', requireAuth, listCheckIns)

router.get('/alerts', requireAuth, listAlerts)
router.patch('/alerts/:id/resolve', requireAuth, resolveAlert)

router.get('/whatsapp/qr', async (_req: Request, res: Response) => {
  const qr = getLatestQr()
  if (!qr) {
    res.json({ ready: isWhatsAppReady(), qr: null })
    return
  }
  try {
    const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
    res.json({ ready: false, qr: dataUrl })
  } catch {
    res.json({ ready: false, qr: null })
  }
})

router.get('/whatsapp/status', (_req: Request, res: Response) => {
  res.json({ ready: isWhatsAppReady() })
})

export default router
