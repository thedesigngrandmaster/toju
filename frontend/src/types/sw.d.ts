interface SyncManager {
  register(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>
  unregister(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

interface ServiceWorkerRegistration {
  sync?: SyncManager
  periodicSync?: PeriodicSyncManager
}
