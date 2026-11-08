import mongoose from 'mongoose'
import { Patient } from '../models/Patient'
import { Alert } from '../models/Alert'
import { CheckIn } from '../models/CheckIn'
import { Note } from '../models/Note'

/**
 * Existing deployments were created before client-generated ids and delta sync.
 * Backfill the fields required by the offline-first protocol before syncing
 * indexes, so unique indexes cannot fail on legacy rows.
 */
export async function backfillLegacyRecords(): Promise<void> {
  try {
    const [patients, alerts, checkIns] = await Promise.all([
      Patient.updateMany(
        { $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }] },
        [
          {
            $set: {
              clientId: { $toString: '$_id' },
              serverVersion: { $ifNull: ['$serverVersion', 1] },
            },
          },
        ]
      ),
      Alert.updateMany(
        { $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }] },
        [
          {
            $set: {
              clientId: { $toString: '$_id' },
              serverVersion: { $ifNull: ['$serverVersion', 1] },
              severity: {
                $ifNull: ['$severity', { $cond: [{ $eq: ['$type', 'red_flag'] }, 'critical', 'warning'] }],
              },
              createdAt: { $ifNull: ['$createdAt', '$timestamp'] },
              updatedAt: { $ifNull: ['$updatedAt', '$timestamp'] },
            },
          },
        ]
      ),
      CheckIn.updateMany(
        { $or: [{ clientId: { $exists: false } }, { clientId: null }, { clientId: '' }] },
        [
          {
            $set: {
              clientId: { $toString: '$_id' },
              serverVersion: { $ifNull: ['$serverVersion', 1] },
              aiStatus: { $ifNull: ['$aiStatus', 'ready'] },
              source: { $ifNull: ['$source', 'sync'] },
              createdAt: { $ifNull: ['$createdAt', '$timestamp'] },
              updatedAt: { $ifNull: ['$updatedAt', '$timestamp'] },
            },
          },
        ]
      ),
    ])

    if (patients.modifiedCount + alerts.modifiedCount + checkIns.modifiedCount > 0) {
      console.log(
        `[DB] Backfilled legacy records — patients: ${patients.modifiedCount}, alerts: ${alerts.modifiedCount}, check-ins: ${checkIns.modifiedCount}`
      )
    }

    // Notes are new in this release; the collection is created lazily.
    await Note.init()
  } catch (error) {
    console.error('[DB] Legacy backfill failed:', error)
  }
}

/** Builds every registered model's indexes after the backfill has completed. */
export async function syncDatabaseIndexes(): Promise<void> {
  try {
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()))
    console.log('[DB] Indexes synchronised')
  } catch (error) {
    console.error('[DB] Index synchronisation failed:', error)
  }
}
