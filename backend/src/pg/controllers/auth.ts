import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { env } from '../../config/env'
import { signAccessToken } from '../../utils/jwt'
import type { AuthRequest } from '../../middleware/auth'
import {
  countPatientsByRisk,
  getDoctorByEmail,
  getDoctorById,
  getDoctorByRefreshHash,
  updateDoctorRefreshHash,
} from '../repo'
import { toDoctorDTO } from '../dto'

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? ('none' as const) : ('lax' as const),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/v1/auth',
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } })
    return
  }

  const doctor = await getDoctorByEmail(email)
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const valid = await bcrypt.compare(password, doctor.password_hash)
  if (!valid) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const accessToken = signAccessToken(doctor.id)
  const refreshToken = crypto.randomBytes(40).toString('hex')
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  await updateDoctorRefreshHash(doctor.id, refreshHash)

  res.cookie('refreshToken', refreshToken, refreshCookieOptions())
  res.json({ accessToken, doctor: toDoctorDTO(doctor) })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token =
    req.cookies?.refreshToken || (req.body as { refreshToken?: string } | undefined)?.refreshToken
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing refresh token' } })
    return
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const doctor = await getDoctorByRefreshHash(hash)
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } })
    return
  }

  res.json({ accessToken: signAccessToken(doctor.id) })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token =
    req.cookies?.refreshToken || (req.body as { refreshToken?: string } | undefined)?.refreshToken
  if (token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const doctor = await getDoctorByRefreshHash(hash)
    if (doctor) await updateDoctorRefreshHash(doctor.id, null)
  }
  res.clearCookie('refreshToken', { path: '/v1/auth' })
  res.json({ message: 'Logged out' })
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const doctor = await getDoctorById(req.doctorId as string)
  if (!doctor) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Doctor not found' } })
    return
  }
  const patientCounts = await countPatientsByRisk(doctor.id)
  res.json({ ...toDoctorDTO(doctor), patientCounts })
}
