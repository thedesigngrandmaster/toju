import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { pool, query } from './db'
import { ensureSchema } from './ensure-schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function insertPatient(
  doctorId: string,
  hospitalId: string,
  data: Record<string, any>,
): Promise<{ id: string; clientId: string }> {
  const clientId = crypto.randomUUID()
  const rows = await query<{ id: string }>(
    `INSERT INTO patients (client_id, doctor_id, hospital_id, data, server_version)
     VALUES ($1, $2, $3, $4::jsonb, 1)
     RETURNING id`,
    [clientId, doctorId, hospitalId, JSON.stringify(data)],
  )
  return { id: rows[0].id, clientId }
}

async function main(): Promise<void> {
  await ensureSchema()

  await query(`
    TRUNCATE TABLE
      outbound_messages,
      inbound_messages,
      audit_logs,
      sync_operations,
      notes,
      check_ins,
      alerts,
      patients,
      doctors,
      hospitals
    RESTART IDENTITY CASCADE
  `)

  const hospitalRows = await query<{ id: string }>(
    `INSERT INTO hospitals (name, address)
     VALUES ($1, $2)
     RETURNING id`,
    ['Lagos University Teaching Hospital', 'Idi-Araba, Lagos'],
  )
  const hospitalId = hospitalRows[0].id

  const passwordHash = await bcrypt.hash('demo2026', 10)
  const doctorRows = await query<{ id: string }>(
    `INSERT INTO doctors (email, password_hash, name, specialty, hospital_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      'dr.kunle@lagos.hospital.ng',
      passwordHash,
      'Dr. Kunle Hassan',
      'Internal Medicine & Cardiology',
      hospitalId,
    ],
  )
  const doctorId = doctorRows[0].id

  const p1 = await insertPatient(doctorId, hospitalId, {
    name: 'Emmanuel Adebayo',
    age: 68,
    phoneNumber: '+2348026709004',
    language: 'english',
    diagnosis: 'Congestive Heart Failure (EF 35%)',
    admittedDate: '2026-02-10',
    dischargedDate: '2026-02-18',
    riskScore: 'red',
    lastCheckIn: '2026-02-21T08:14:00.000Z',
    checkInToken: crypto.randomBytes(20).toString('hex'),
    signal: {
      patientSummary:
        'You were treated for a heart condition called Congestive Heart Failure. Your heart was not pumping blood as well as it should. You are now on medicines to help your heart work better and remove extra fluid from your body. It is very important to take your medicines every day and watch for any new swelling in your legs.',
      rawNotes:
        'Patient: Emmanuel Adebayo, 68M. Admitted 10/02/2026 with progressive dyspnea and bilateral pedal edema. Echo showed EF 35%. Dx: CHF with reduced EF. Medications on discharge: Furosemide 40mg OD, Lisinopril 10mg OD (new), Carvedilol 6.25mg BD (dose reduced from 12.5mg), Aspirin 75mg OD (continued). Stopped: Amlodipine. Red flags: sudden weight gain >2kg in 24hrs, increasing leg swelling, shortness of breath at rest, chest pain. Follow-up: Cardiology OPD in 2 weeks. Fluid restriction: 1.5L/day.',
      medications: [
        { name: 'Furosemide', dose: '40mg', frequency: 'Once daily (morning)', status: 'continued', confidence: 0.97 },
        { name: 'Lisinopril', dose: '10mg', frequency: 'Once daily', status: 'started', confidence: 0.95 },
        { name: 'Carvedilol', dose: '6.25mg', frequency: 'Twice daily', status: 'adjusted', confidence: 0.93 },
        { name: 'Aspirin', dose: '75mg', frequency: 'Once daily', status: 'continued', confidence: 0.98 },
        { name: 'Amlodipine', dose: '—', frequency: '—', status: 'stopped', confidence: 0.96 },
      ],
      redFlags: [
        'Sudden weight gain more than 2kg in one day',
        'Increasing swelling in legs or ankles',
        'Shortness of breath while resting',
        'Chest pain or tightness',
      ],
      monitoringSchedule: [
        { question: 'Did you take all your medicines this morning?', frequency: 'daily', time: '08:00' },
        { question: 'How are you feeling? Any leg swelling today?', frequency: 'daily', time: '08:05' },
        { question: 'Did you weigh yourself today? What was the reading?', frequency: 'daily', time: '08:10' },
      ],
      diagnosis: 'Congestive Heart Failure (EF 35%)',
      confidence: 0.95,
      approvedAt: '2026-02-18T14:30:00.000Z',
      approvedBy: doctorId,
      provenance: {
        model: 'gemini-2.5-flash',
        promptVersion: 'signal-extraction@2.1.0',
        generatedAt: '2026-02-18T14:20:00.000Z',
        source: 'gemini',
        confidence: 0.95,
      },
    },
  })

  const p2 = await insertPatient(doctorId, hospitalId, {
    name: 'Fatima Bello',
    age: 54,
    phoneNumber: '+2349024071025',
    language: 'english',
    diagnosis: 'Type 2 Diabetes Mellitus — DKA',
    admittedDate: '2026-02-12',
    dischargedDate: '2026-02-17',
    riskScore: 'yellow',
    lastCheckIn: '2026-02-19T09:22:00.000Z',
    checkInToken: crypto.randomBytes(20).toString('hex'),
    signal: {
      patientSummary:
        'You were treated for a complication of diabetes called DKA where your blood sugar became dangerously high. You are now back on insulin and a new diabetes tablet. Please check your blood sugar every morning and evening and call us if it is above 15 or below 4.',
      rawNotes:
        'Patient: Fatima Bello, 54F. Admitted 12/02 with DKA. BS on admission 28mmol/L. Managed with IV fluids and insulin. Discharged stable. Meds: Metformin 500mg BD (restarted), Insulin Glargine 20 units nocte (new). Red flags: BS >15, BS <4, vomiting, fruity smell on breath. Monitor: BS twice daily. Follow-up: Endocrine clinic 1 week.',
      medications: [
        { name: 'Metformin', dose: '500mg', frequency: 'Twice daily with food', status: 'continued', confidence: 0.96 },
        { name: 'Insulin Glargine', dose: '20 units', frequency: 'Once at bedtime', status: 'started', confidence: 0.94 },
      ],
      redFlags: [
        'Blood sugar reading above 15',
        'Blood sugar reading below 4',
        'Vomiting or nausea that lasts more than 2 hours',
        'Fruity smell on breath',
      ],
      monitoringSchedule: [
        { question: 'What was your blood sugar reading this morning?', frequency: 'daily', time: '07:00' },
        { question: 'Did you take your insulin at bedtime last night?', frequency: 'daily', time: '07:05' },
      ],
      diagnosis: 'Type 2 Diabetes Mellitus — DKA',
      confidence: 0.93,
      approvedAt: '2026-02-17T11:00:00.000Z',
      approvedBy: doctorId,
      provenance: {
        model: 'gemini-2.5-flash',
        promptVersion: 'signal-extraction@2.1.0',
        generatedAt: '2026-02-17T10:45:00.000Z',
        source: 'gemini',
        confidence: 0.93,
      },
    },
  })

  const p3 = await insertPatient(doctorId, hospitalId, {
    name: 'Chukwuemeka Obi',
    age: 45,
    phoneNumber: '+2349065718162',
    language: 'pidgin',
    diagnosis: 'Hypertensive Emergency',
    admittedDate: '2026-02-14',
    dischargedDate: '2026-02-19',
    riskScore: 'green',
    lastCheckIn: '2026-02-21T07:55:00.000Z',
    checkInToken: crypto.randomBytes(20).toString('hex'),
    signal: {
      patientSummary:
        'Your blood pressure became very dangerously high and needed emergency treatment. You are now on two blood pressure medicines. Take them every morning without fail — skipping even one dose can cause a stroke.',
      rawNotes:
        'Patient: Chukwuemeka Obi, 45M. BP on admission 210/130. Hypertensive emergency. Managed IV labetalol, transitioned to oral. Discharge meds: Amlodipine 10mg OD, Losartan 100mg OD. Red flags: severe headache, blurred vision, BP >180. Low-salt diet. No strenuous exercise for 2 weeks.',
      medications: [
        { name: 'Amlodipine', dose: '10mg', frequency: 'Once daily (morning)', status: 'started', confidence: 0.97 },
        { name: 'Losartan', dose: '100mg', frequency: 'Once daily (morning)', status: 'started', confidence: 0.97 },
      ],
      redFlags: [
        'Severe or sudden headache unlike previous ones',
        'Blurred or double vision',
        'Blood pressure reading above 180',
        'Weakness or numbness on one side of body',
      ],
      monitoringSchedule: [
        { question: 'Good morning! Did you take your blood pressure medicines today?', frequency: 'daily', time: '08:00' },
        { question: 'Any headache or vision changes today?', frequency: 'daily', time: '08:05' },
      ],
      diagnosis: 'Hypertensive Emergency',
      confidence: 0.97,
      approvedAt: '2026-02-19T10:15:00.000Z',
      approvedBy: doctorId,
      provenance: {
        model: 'gemini-2.5-flash',
        promptVersion: 'signal-extraction@2.1.0',
        generatedAt: '2026-02-19T10:00:00.000Z',
        source: 'gemini',
        confidence: 0.97,
      },
    },
  })

  const p4 = await insertPatient(doctorId, hospitalId, {
    name: 'Aisha Musa',
    age: 72,
    phoneNumber: '+2348045678901',
    language: 'yoruba',
    diagnosis: 'Pneumonia — Awaiting Signal',
    admittedDate: '2026-02-19',
    dischargedDate: '2026-02-21',
    riskScore: 'unmonitored',
    lastCheckIn: null,
    checkInToken: crypto.randomBytes(20).toString('hex'),
    signal: null,
  })

  const checkIns = [
    {
      patientId: p1.id,
      clientId: crypto.randomUUID(),
      data: {
        timestamp: '2026-02-21T08:14:00.000Z',
        message: 'I took the medicine but my legs are very swollen this morning',
        riskScore: 'red',
        triggeredFlags: ['Increasing swelling in legs or ankles'],
        botResponse:
          'Papa Emmanuel, leg swelling is something we take seriously for your heart. I have already sent a message to Dr. Kunle. Please sit with your legs raised on a pillow. Do not eat or drink too much water right now. Dr. Kunle will reach out to you soon.',
      },
    },
    {
      patientId: p1.id,
      clientId: crypto.randomUUID(),
      data: {
        timestamp: '2026-02-20T08:10:00.000Z',
        message: 'Yes I took everything. Feeling ok today.',
        riskScore: 'green',
        triggeredFlags: [],
        botResponse: 'Wonderful! Well done for taking your medicines. Keep going strong, Papa Emmanuel. Speak tomorrow.',
      },
    },
    {
      patientId: p2.id,
      clientId: crypto.randomUUID(),
      data: {
        timestamp: '2026-02-19T09:22:00.000Z',
        message: 'My sugar was 13 this morning. I forgot to take insulin last night.',
        riskScore: 'yellow',
        triggeredFlags: [],
        botResponse:
          'Thank you for telling me, Fatima. A reading of 13 is a bit high — please take your medication now and try not to miss doses. If it goes above 15 or you feel unwell, let me know right away.',
      },
    },
    {
      patientId: p3.id,
      clientId: crypto.randomUUID(),
      data: {
        timestamp: '2026-02-21T07:55:00.000Z',
        message: 'Yes doctor, took both medicines. Feeling fine, no headache.',
        riskScore: 'green',
        triggeredFlags: [],
        botResponse: 'Excellent work, Emeka! Keep it up — your consistency is what will keep you safe. Talk tomorrow.',
      },
    },
  ]

  for (const checkIn of checkIns) {
    await query(
      `INSERT INTO check_ins (client_id, doctor_id, patient_id, data, server_version)
       VALUES ($1, $2, $3, $4::jsonb, 1)`,
      [checkIn.clientId, doctorId, checkIn.patientId, JSON.stringify(checkIn.data)],
    )
  }

  await query(
    `INSERT INTO alerts (client_id, doctor_id, patient_id, data, server_version)
     VALUES
       ($1, $2, $3, $4::jsonb, 1),
       ($5, $2, $6, $7::jsonb, 1)`,
    [
      crypto.randomUUID(),
      doctorId,
      p1.id,
      JSON.stringify({
        timestamp: '2026-02-21T08:14:00.000Z',
        type: 'red_flag',
        message: 'Patient reported increasing leg swelling — possible CHF exacerbation.',
        resolved: false,
        resolvedAt: null,
        severity: 'critical',
      }),
      crypto.randomUUID(),
      p2.id,
      JSON.stringify({
        timestamp: '2026-02-20T08:00:00.000Z',
        type: 'missed_checkin',
        message: 'Patient missed 2 consecutive daily check-ins.',
        resolved: false,
        resolvedAt: null,
        severity: 'warning',
      }),
    ],
  )

  await query(
    `INSERT INTO notes (client_id, doctor_id, patient_id, data, server_version)
     VALUES
       ($1, $2, $3, $4::jsonb, 1),
       ($5, $2, $6, $7::jsonb, 1)`,
    [
      crypto.randomUUID(),
      doctorId,
      p1.id,
      JSON.stringify({
        body: 'Patient called the clinic line. Advised to reduce fluid intake and weigh daily. Cardiology review remains scheduled.',
        authorId: doctorId,
        authorName: 'Dr. Kunle Hassan',
        createdAt: '2026-02-21T09:00:00.000Z',
      }),
      crypto.randomUUID(),
      p2.id,
      JSON.stringify({
        body: 'Discussed insulin technique and missed-dose plan. Patient to send morning glucose readings for the next 3 days.',
        authorId: doctorId,
        authorName: 'Dr. Kunle Hassan',
        createdAt: '2026-02-20T10:30:00.000Z',
      }),
    ],
  )

  console.log('[PG-SEED] Done.')
  console.log('  Doctor: dr.kunle@lagos.hospital.ng / demo2026')
  console.log('  Patients: 4 (Emmanuel, Fatima, Chukwuemeka, Aisha)')
  console.log('  Check-ins: 4, alerts: 2, notes: 2')
  console.log(`  Patient ids: ${p1.clientId}, ${p2.clientId}, ${p3.clientId}, ${p4.clientId}`)
  await pool.end()
}

main().catch((error) => {
  console.error('[PG-SEED] Failed:', error)
  process.exit(1)
})
