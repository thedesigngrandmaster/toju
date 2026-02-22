import jwt from 'jsonwebtoken'
import { env } from '../config/env'
interface TokenPayload {
  sub: string
}
export function signAccessToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions)
}
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload
}
export function signRefreshToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)
}
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
}
