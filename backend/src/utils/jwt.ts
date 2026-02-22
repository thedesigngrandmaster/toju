import jwt from 'jsonwebtoken'
import { env } from '../config/env'
interface TokenPayload {
  sub: string
}
export function signAccessToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions)
}
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload
}
export function signRefreshToken(doctorId: string): string {
  return jwt.sign({ sub: doctorId }, env.jwtSecret, {
    expiresIn: '7d',
  } as jwt.SignOptions)
}
export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload
}
