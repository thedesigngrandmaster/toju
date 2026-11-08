import { db, getJsonMeta, getMeta, setJsonMeta, setMeta } from './db'
import { uuid } from './utils'
import type { Doctor } from '@/types'

const TOKEN_KEY = 'toju_token'
const DOCTOR_KEY = 'toju_doctor'
const DEVICE_KEY = 'toju_device_id'

let token: string | null = null
let doctor: Doctor | null = null

export interface StoredAuth {
  token: string | null
  doctor: Doctor | null
}

/** Synchronous boot read – localStorage is available before IndexedDB opens. */
export function loadAuthFromCache(): StoredAuth {
  try {
    token = localStorage.getItem(TOKEN_KEY)
    const rawDoctor = localStorage.getItem(DOCTOR_KEY)
    doctor = rawDoctor ? (JSON.parse(rawDoctor) as Doctor) : null
  } catch {
    token = null
    doctor = null
  }
  return { token, doctor }
}

export function getToken(): string | null {
  return token
}

export function getCachedDoctor(): Doctor | null {
  return doctor
}

/**
 * Tokens are mirrored into IndexedDB so the service worker can perform
 * background outbox pushes when no page is open (Chromium Background Sync).
 */
export async function setToken(next: string | null): Promise<void> {
  token = next
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  try {
    if (next) await setMeta('auth.accessToken', next)
    else await db.meta.delete('auth.accessToken')
  } catch {
    /* SW mirror is best effort */
  }
}

export async function setDoctor(next: Doctor | null): Promise<void> {
  doctor = next
  try {
    if (next) localStorage.setItem(DOCTOR_KEY, JSON.stringify(next))
    else localStorage.removeItem(DOCTOR_KEY)
  } catch {
    /* ignore */
  }
  try {
    if (next) await setJsonMeta('auth.doctor', next)
    else await db.meta.delete('auth.doctor')
  } catch {
    /* ignore */
  }
}

export async function clearAuth(): Promise<void> {
  await setToken(null)
  await setDoctor(null)
  await db.meta.delete('auth.refreshFailedAt')
}

/** Doctor cached in IndexedDB – used when the app boots offline. */
export async function getIndexedDoctor(): Promise<Doctor | null> {
  return getJsonMeta<Doctor>('auth.doctor')
}

export async function getDeviceId(): Promise<string> {
  const existing = await getMeta(DEVICE_KEY)
  if (existing) return existing
  const id = uuid()
  await setMeta(DEVICE_KEY, id)
  return id
}

export async function getIndexedToken(): Promise<string | null> {
  return getMeta('auth.accessToken')
}
