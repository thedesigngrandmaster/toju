import { Alert } from '../models/Alert'
import { Patient } from '../models/Patient'
export async function reevaluatePatientRisk(patientId: string): Promise<string> {
  const [openRedFlags, openMissedCheckins] = await Promise.all([
    Alert.countDocuments({ patientId, type: 'red_flag', resolved: false }),
    Alert.countDocuments({ patientId, type: 'missed_checkin', resolved: false }),
  ])
  let newRisk: string
  if (openRedFlags > 0) {
    newRisk = 'red'
  } else if (openMissedCheckins >= 2) {
    newRisk = 'yellow'
  } else {
    newRisk = 'green'
  }
  await Patient.findByIdAndUpdate(patientId, { riskScore: newRisk })
  return newRisk
}
