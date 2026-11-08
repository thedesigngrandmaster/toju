import { useSyncExternalStore } from 'react'
import { getPwaSnapshot, subscribePwa } from '@/lib/pwa'

export function useInstallState(): 'installable' | 'ios' | 'installed' | 'none' {
  return useSyncExternalStore(
    subscribePwa,
    getPwaSnapshot,
    () => 'none',
  ) as 'installable' | 'ios' | 'installed' | 'none'
}
