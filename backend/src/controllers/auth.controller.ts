import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { env } from '../config/env'

function signToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions)
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string }
  const doctor = await Doctor.findOne({ email }).lean()
  if (!doctor) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  const valid = await bcrypt.compare(password, doctor.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  const token = signToken(String(doctor._id))
  const refreshToken = crypto.randomBytes(40).toString('hex')
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  await Doctor.updateOne({ _id: doctor._id }, { refreshTokenHash: refreshHash })

  const hospital = await Hospital.findById(doctor.hospitalId).lean()
  res.json({
    token,
    refreshToken,
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
  const { refreshToken } = req.body as { refreshToken: string }
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const doctor = await Doctor.findOne({ refreshTokenHash: hash })
  if (!doctor) {
    res.status(401).json({ error: 'Invalid refresh token' })
    return
  }
  const token = signToken(String(doctor._id))
  res.json({ token })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string }
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  await Doctor.updateOne({ refreshTokenHash: hash }, { refreshTokenHash: null })
  res.json({ ok: true })
}
