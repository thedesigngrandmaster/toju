import cron from 'node-cron'
import crypto from 'crypto'
import { Patient } from '../models/Patient'
import { Alert } from '../models/Alert'
import { buildCheckInMessage } from '../services/whatsapp'
import { enqueueOutboundMessage } from '../services/outbound'
import { recordAudit } from '../services/audit'

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function startCronJobs(): void {
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Queueing daily check-ins…')
    try {
      const patients = await Patient.find({
        riskScore: { $in: ['green', 'yellow', 'red'] },
        'signal.approvedAt': { $ne: null },
      }).lean()

      let queued = 0
      for (const patient of patients) {
        const schedule = patient.signal?.monitoringSchedule ?? []
        if (!schedule.length) continue
        const question = schedule[0].question
        await enqueueOutboundMessage({
          idempotencyKey: `checkin:${patient.clientId}:${dayKey()}`,
          doctorId: patient.doctorId,
          patientId: patient._id,
          phoneNumber: patient.phoneNumber,
          body: buildCheckInMessage(patient.name, question),
          kind: 'checkin',
          priority: patient.riskScore === 'red' ? 90 : 20,
        })
        queued += 1
      }
      console.log(`[CRON] Queued check-ins for ${queued} patients`)
    } catch (error) {
      console.error('[CRON] Daily dispatch error:', error)
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

      let flagged = 0
      for (const patient of patients) {
        const existingAlert = await Alert.findOne({
          patientId: patient._id,
          type: 'missed_checkin',
          resolved: false,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
        if (existingAlert) continue

        await Alert.create({
          clientId: crypto.randomUUID(),
          patientId: patient._id,
          doctorId: patient.doctorId,
          type: 'missed_checkin',
          message: `${patient.name} missed their daily check-in.`,
          severity: 'warning',
        })

        if (patient.riskScore === 'green') {
          await Patient.updateOne(
            { _id: patient._id },
            { $set: { riskScore: 'yellow' }, $inc: { serverVersion: 1 } }
          )
        }

        await recordAudit({
          doctorId: String(patient.doctorId),
          actor: 'system',
          action: 'alert.missed_checkin',
          entityType: 'patient',
          entityId: patient.clientId,
          summary: `${patient.name} missed their daily check-in`,
          detail: { lastCheckIn: patient.lastCheckIn },
        })
        flagged += 1
      }
      console.log(`[CRON] Flagged ${flagged} missed check-ins`)
    } catch (error) {
      console.error('[CRON] Missed check-in error:', error)
    }
  })
}
