import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Doctor } from '../models/Doctor'
import { Hospital } from '../models/Hospital'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'
import { AppError } from '../utils/AppError'
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, 
    path: '/',
  })
}
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string }
  const doctor = await Doctor.findOne({ email: email.toLowerCase() })
  if (!doctor) {
    res.status(401).json({ success: false, error: 'Invalid email or password.' })
    return
  }
  const valid = await bcrypt.compare(password, doctor.passwordHash)
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid email or password.' })
    return
  }
  const accessToken = signAccessToken(String(doctor._id))
  const refreshToken = signRefreshToken(String(doctor._id))
  const refreshHash = hashToken(refreshToken)
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await Doctor.updateOne({ _id: doctor._id }, {
    refreshTokenHash: refreshHash,
    refreshTokenExpiresAt: refreshExpiresAt,
  })
  setRefreshCookie(res, refreshToken)
  const hospital = await Hospital.findById(doctor.hospitalId).lean()
  res.json({
    success: true,
    data: {
      accessToken,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty,
        hospital: hospital ? { id: hospital._id, name: hospital.name } : null,
      },
    },
  })
}
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token
  if (!token) {
    res.status(401).json({ success: false, error: 'No refresh token.' })
    return
  }
  try {
    const payload = verifyRefreshToken(token)
    const hash = hashToken(token)
    const doctor = await Doctor.findOne({
      _id: payload.sub,
      refreshTokenHash: hash,
      refreshTokenExpiresAt: { $gt: new Date() },
    })
    if (!doctor) {
      res.status(401).json({ success: false, error: 'Invalid refresh token.' })
      return
    }
    const accessToken = signAccessToken(String(doctor._id))
    const newRefreshToken = signRefreshToken(String(doctor._id))
    const newHash = hashToken(newRefreshToken)
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await Doctor.updateOne({ _id: doctor._id }, {
      refreshTokenHash: newHash,
      refreshTokenExpiresAt: newExpiry,
    })
    setRefreshCookie(res, newRefreshToken)
    res.json({ success: true, data: { accessToken } })
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token.' })
  }
}
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token
  if (token) {
    const hash = hashToken(token)
    await Doctor.updateOne(
      { refreshTokenHash: hash },
      { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } }
    )
  }
  res.clearCookie('refresh_token', { path: '/' })
  res.json({ success: true, message: 'Logged out.' })
}
