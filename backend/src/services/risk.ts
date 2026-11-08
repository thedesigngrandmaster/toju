import { Alert } from '../models/Alert'
import { Patient, type RiskScore } from '../models/Patient'
import { CheckIn } from '../models/CheckIn'

/**
 * Recomputes a patient's risk from open alerts and the most recent check-in.
 * Bumps the server version so the next delta pull is visible to every device.
 */
export async function recomputePatientRisk(patientId: string): Promise<RiskScore> {
  const [openRedFlags, openMissedCheckins, latestCheckIn] = await Promise.all([
    Alert.countDocuments({ patientId, type: 'red_flag', resolved: false }),
    Alert.countDocuments({ patientId, type: 'missed_checkin', resolved: false }),
    CheckIn.findOne({ patientId }).sort({ timestamp: -1 }).lean(),
  ])

  let nextRisk: RiskScore = 'green'
  if (openRedFlags > 0) nextRisk = 'red'
  else if (openMissedCheckins > 0) nextRisk = 'yellow'
  else if (latestCheckIn?.riskScore === 'red' || latestCheckIn?.riskScore === 'yellow') nextRisk = 'yellow'

  await Patient.updateOne({ _id: patientId }, { $set: { riskScore: nextRisk }, $inc: { serverVersion: 1 } })
  return nextRisk
}

/** Backwards-compatible alias used by the legacy alert controller. */
export async function reevaluatePatientRisk(patientId: string): Promise<string> {
  return recomputePatientRisk(patientId)
}
