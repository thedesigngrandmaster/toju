import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { env } from '../config/env'
import type { AuthRequest } from '../middleware/auth'

function signAccessToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions)
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string }
  if (!email || !password) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } })
    return
  }

  const doctor = await Doctor.findOne({ email: email.toLowerCase() }).lean()
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const valid = await bcrypt.compare(password, doctor.passwordHash)
  if (!valid) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    return
  }

  const accessToken = signAccessToken(String(doctor._id))
  const refreshToken = crypto.randomBytes(40).toString('hex')
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  await Doctor.updateOne({ _id: doctor._id }, { refreshTokenHash: refreshHash })

  const hospital = await Hospital.findById(doctor.hospitalId).lean()

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/v1/auth',
  })

  res.json({
    accessToken,
    doctor: {
      id: doctor._id,
      name: doctor.name,
      specialty: doctor.specialty,
      email: doctor.email,
      hospital: hospital?.name ?? '',
    },
  })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken || (req.body as { refreshToken?: string }).refreshToken
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing refresh token' } })
    return
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const doctor = await Doctor.findOne({ refreshTokenHash: hash })
  if (!doctor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } })
    return
  }

  const accessToken = signAccessToken(String(doctor._id))
  res.json({ accessToken })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken || (req.body as { refreshToken?: string }).refreshToken
  if (token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    await Doctor.updateOne({ refreshTokenHash: hash }, { refreshTokenHash: null })
  }

  res.clearCookie('refreshToken', { path: '/v1/auth' })
  res.json({ message: 'Logged out' })
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const doctor = await Doctor.findById(req.doctorId).lean()
  if (!doctor) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Doctor not found' } })
    return
  }

  const hospital = await Hospital.findById(doctor.hospitalId).lean()
  res.json({
    id: doctor._id,
    name: doctor.name,
    specialty: doctor.specialty,
    email: doctor.email,
    hospital: hospital?.name ?? '',
  })
}
