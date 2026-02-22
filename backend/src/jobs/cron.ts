import cron from 'node-cron'
import { Patient } from '../models/Patient'
import { Alert } from '../models/Alert'
import { sendMessage, buildCheckInMessage, isWhatsAppReady } from '../services/whatsapp'

export function startCronJobs(): void {
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Dispatching daily check-ins…')
    if (!isWhatsAppReady()) {
      console.warn('[CRON] WhatsApp not ready, skipping dispatch')
      return
    }
    try {
      const patients = await Patient.find({
        riskScore: { $in: ['green', 'yellow', 'red'] },
        'signal.approvedAt': { $ne: null },
      }).lean()

      for (const patient of patients) {
        const schedule = (patient.signal as any)?.monitoringSchedule ?? []
        if (!schedule.length) continue
        const question = schedule[0].question
        const msg = buildCheckInMessage(patient.name, question)
        await sendMessage(patient.phoneNumber, msg).catch((err: Error) =>
          console.error(`[CRON] WhatsApp failed for ${patient.name}:`, err.message)
        )
      }
      console.log(`[CRON] Sent check-ins to ${patients.length} patients`)
    } catch (err) {
      console.error('[CRON] Daily dispatch error:', err)
    }
  })

  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Checking for missed check-ins…')
    try {
      const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000)
      const patients = await Patient.find({
        riskScore: { $in: ['green', 'yellow', 'red'] },
        'signal.approvedAt': { $ne: null },
        $or: [{ lastCheckIn: null }, { lastCheckIn: { $lt: cutoff } }],
      }).lean()

      for (const patient of patients) {
        const existingAlert = await Alert.findOne({
          patientId: patient._id,
          type: 'missed_checkin',
          resolved: false,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
        if (!existingAlert) {
          await Alert.create({
            patientId: patient._id,
            doctorId: patient.doctorId,
            type: 'missed_checkin',
            message: `${patient.name} missed their daily check-in.`,
          })
          if (patient.riskScore === 'green') {
            await Patient.updateOne({ _id: patient._id }, { riskScore: 'yellow' })
          }
        }
      }
      console.log(`[CRON] Flagged ${patients.length} missed check-ins`)
    } catch (err) {
      console.error('[CRON] Missed check-in error:', err)
    }
  })
}
