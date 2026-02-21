import cron from 'node-cron'
import { Patient } from '../models/Patient'
import { Alert } from '../models/Alert'
import { sendWhatsAppMessage } from '../services/whatsapp'
import { logger } from '../utils/logger'
export function startCronJobs(): void {
  cron.schedule('0 7 * * *', async () => {
    logger.info('[CRON] Dispatching daily check-ins…')
    try {
      const patients = await Patient.find({
        riskScore: { $ne: 'unmonitored' },
        'signal.approvedAt': { $ne: null },
      }).lean()
      for (const patient of patients) {
        const dailyQuestions = (patient.signal?.monitoringItems ?? [])
          .filter(item => item.frequency === 'daily')
          .map(item => item.question)
          .join('\n')
        if (!dailyQuestions) continue
        const firstName = patient.name.split(' ')[0]
        const greeting = `Good morning, ${firstName}! 👋\n${dailyQuestions}`
        await sendWhatsAppMessage(patient.phoneNumber, greeting).catch((err: Error) =>
          logger.error(`[CRON] WhatsApp failed for ${patient.name}:`, err.message)
        )
      }
      logger.info(`[CRON] Sent check-ins to ${patients.length} patients`)
    } catch (err) {
      logger.error('[CRON] Daily dispatch error:', err)
    }
  })
  cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Checking for missed check-ins…')
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000) 
      const lapsed = await Patient.find({
        riskScore: { $ne: 'unmonitored' },
        'signal.approvedAt': { $ne: null },
        $or: [
          { lastCheckIn: null },
          { lastCheckIn: { $lt: cutoff } },
        ],
      }).lean()
      for (const patient of lapsed) {
        await Alert.create({
          patientId: patient._id,
          doctorId: patient.doctorId,
          type: 'missed_checkin',
          message: `${patient.name} has not responded to today's check-in.`,
        })
        const recentMisses = await Alert.countDocuments({
          patientId: patient._id,
          type: 'missed_checkin',
          resolved: false,
          timestamp: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        })
        if (recentMisses >= 2 && patient.riskScore === 'green') {
          await Patient.findByIdAndUpdate(patient._id, { riskScore: 'yellow' })
        }
      }
      logger.info(`[CRON] Flagged ${lapsed.length} missed check-ins`)
    } catch (err) {
      logger.error('[CRON] Missed check-in error:', err)
    }
  })
  logger.info('[CRON] Scheduled jobs registered')
}
