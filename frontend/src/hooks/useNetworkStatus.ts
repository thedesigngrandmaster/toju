import { useSyncExternalStore } from 'react'
import { getNetworkSnapshot, subscribeNetwork } from '@/lib/network'

export type NetworkStatus = 'online' | 'offline' | 'unreachable' | 'simulated-offline'

export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(
    subscribeNetwork,
    getNetworkSnapshot,
    () => 'online',
  ) as NetworkStatus
}

export function useIsOnline(): boolean {
  return useNetworkStatus() === 'online'
}
