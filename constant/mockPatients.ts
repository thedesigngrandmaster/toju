import { Patient } from '@/types'

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p-001',
    name: 'Emmanuel Adebayo',
    age: 68,
    diagnosis: 'Congestive Heart Failure',
    admittedDate: '2026-02-10',
    dischargedDate: '2026-02-18',
    doctorId: 'dr-001',
    riskScore: 'red',
    phoneNumber: '+2348012345678',
    lastCheckIn: '2026-02-21T08:14:00Z',
    signal: {
      patientSummary:
        'You were treated for a heart condition called Congestive Heart Failure. Your heart was not pumping blood as well as it should. You are now on medicines to help your heart work better and remove extra fluid from your body. It is very important to take your medicines every day and watch for any new swelling in your legs.',
      rawNotes:
        'Patient: Emmanuel Adebayo, 68M. Admitted 10/02/2026 with progressive dyspnea and bilateral pedal edema. Echo showed EF 35%. Dx: CHF with reduced EF. Medications on discharge: Furosemide 40mg OD, Lisinopril 10mg OD (new), Carvedilol 6.25mg BD (dose reduced from 12.5mg), Aspirin 75mg OD (continued). Stopped: Amlodipine. Red flags: sudden weight gain >2kg in 24hrs, increasing leg swelling, shortness of breath at rest, chest pain. Follow-up: Cardiology OPD in 2 weeks. Fluid restriction: 1.5L/day.',
      medications: [
        { id: 'm1', name: 'Furosemide', dose: '40mg', frequency: 'Once daily (morning)', status: 'continued', confidence: 0.97 },
        { id: 'm2', name: 'Lisinopril', dose: '10mg', frequency: 'Once daily', status: 'started', confidence: 0.95 },
        { id: 'm3', name: 'Carvedilol', dose: '6.25mg', frequency: 'Twice daily', status: 'adjusted', confidence: 0.93 },
        { id: 'm4', name: 'Aspirin', dose: '75mg', frequency: 'Once daily', status: 'continued', confidence: 0.98 },
        { id: 'm5', name: 'Amlodipine', dose: '—', frequency: '—', status: 'stopped', confidence: 0.96 },
      ],
      redFlags: [
        'Sudden weight gain more than 2kg in one day',
        'Increasing swelling in legs or ankles',
        'Shortness of breath while resting',
        'Chest pain or tightness',
      ],
      monitoringSchedule: [
        { id: 'ms1', question: 'Did you take all your medicines this morning?', frequency: 'daily', time: '08:00' },
        { id: 'ms2', question: 'How are you feeling? Any leg swelling today?', frequency: 'daily', time: '08:05' },
        { id: 'ms3', question: 'Did you weigh yourself today? What was the reading?', frequency: 'daily', time: '08:10' },
      ],
      diagnosis: 'Congestive Heart Failure (EF 35%)',
      confidence: 0.95,
      approvedAt: '2026-02-18T14:30:00Z',
    },
    checkIns: [
      {
        id: 'ci-001',
        timestamp: '2026-02-21T08:14:00Z',
        message: 'I took the medicine but my legs are very swollen this morning',
        riskScore: 'red',
        triggeredFlags: ['Increasing swelling in legs or ankles'],
        botResponse:
          'Papa Emmanuel, leg swelling is something we take seriously for your heart. I have already sent a message to Dr. Kunle. Please sit with your legs raised on a pillow. Do not eat or drink too much water right now. Dr. Kunle will reach out to you soon.',
      },
      {
        id: 'ci-002',
        timestamp: '2026-02-20T08:10:00Z',
        message: 'Yes I took everything. Feeling ok today.',
        riskScore: 'green',
        triggeredFlags: [],
        botResponse: 'Wonderful! Well done for taking your medicines. Keep going strong, Papa Emmanuel. Speak tomorrow.',
      },
    ],
    alerts: [
      {
        id: 'al-001',
        timestamp: '2026-02-21T08:14:00Z',
        type: 'red_flag',
        message: 'Patient reported increasing leg swelling — possible CHF exacerbation.',
        resolved: false,
      },
    ],
  },
  {
    id: 'p-002',
    name: 'Fatima Bello',
    age: 54,
    diagnosis: 'Type 2 Diabetes — Post-DKA',
    admittedDate: '2026-02-12',
    dischargedDate: '2026-02-17',
    doctorId: 'dr-001',
    riskScore: 'yellow',
    phoneNumber: '+2348023456789',
    lastCheckIn: '2026-02-19T09:22:00Z',
    signal: {
      patientSummary:
        'You were treated for a complication of diabetes called DKA where your blood sugar became dangerously high. You are now back on insulin and a new diabetes tablet. Please check your blood sugar every morning and evening and call us if it is above 15 or below 4.',
      rawNotes:
        'Patient: Fatima Bello, 54F. Admitted 12/02 with DKA. BS on admission 28mmol/L. Managed with IV fluids and insulin. Discharged stable. Meds: Metformin 500mg BD (restarted), Insulin Glargine 20 units nocte (new). Red flags: BS >15, BS <4, vomiting, fruity smell on breath. Monitor: BS twice daily. Follow-up: Endocrine clinic 1 week.',
      medications: [
        { id: 'm1', name: 'Metformin', dose: '500mg', frequency: 'Twice daily with food', status: 'continued', confidence: 0.96 },
        { id: 'm2', name: 'Insulin Glargine', dose: '20 units', frequency: 'Once at bedtime', status: 'started', confidence: 0.94 },
      ],
      redFlags: [
        'Blood sugar reading above 15',
        'Blood sugar reading below 4',
        'Vomiting or nausea that lasts more than 2 hours',
        'Fruity smell on breath',
      ],
      monitoringSchedule: [
        { id: 'ms1', question: 'What was your blood sugar reading this morning?', frequency: 'daily', time: '07:00' },
        { id: 'ms2', question: 'Did you take your insulin at bedtime last night?', frequency: 'daily', time: '07:05' },
      ],
      diagnosis: 'Type 2 Diabetes Mellitus — DKA',
      confidence: 0.93,
      approvedAt: '2026-02-17T11:00:00Z',
    },
    checkIns: [
      {
        id: 'ci-003',
        timestamp: '2026-02-19T09:22:00Z',
        message: 'My sugar was 13 this morning. I forgot to take insulin last night.',
        riskScore: 'yellow',
        triggeredFlags: [],
        botResponse:
          'Thank you for telling me, Fatima. A reading of 13 is a bit high — please take your medication now and try not to miss doses. If it goes above 15 or you feel unwell, let me know right away.',
      },
    ],
    alerts: [
      {
        id: 'al-002',
        timestamp: '2026-02-20T08:00:00Z',
        type: 'missed_checkin',
        message: 'Patient missed 2 consecutive daily check-ins.',
        resolved: false,
      },
    ],
  },
  {
    id: 'p-003',
    name: 'Chukwuemeka Obi',
    age: 45,
    diagnosis: 'Hypertensive Emergency',
    admittedDate: '2026-02-14',
    dischargedDate: '2026-02-19',
    doctorId: 'dr-001',
    riskScore: 'green',
    phoneNumber: '+2348034567890',
    lastCheckIn: '2026-02-21T07:55:00Z',
    signal: {
      patientSummary:
        'Your blood pressure became very dangerously high and needed emergency treatment. You are now on two blood pressure medicines. Take them every morning without fail — skipping even one dose can cause a stroke.',
      rawNotes:
        'Patient: Chukwuemeka Obi, 45M. BP on admission 210/130. Hypertensive emergency. Managed IV labetalol, transitioned to oral. Discharge meds: Amlodipine 10mg OD, Losartan 100mg OD. Red flags: severe headache, blurred vision, BP >180. Low-salt diet. No strenuous exercise for 2 weeks.',
      medications: [
        { id: 'm1', name: 'Amlodipine', dose: '10mg', frequency: 'Once daily (morning)', status: 'started', confidence: 0.97 },
        { id: 'm2', name: 'Losartan', dose: '100mg', frequency: 'Once daily (morning)', status: 'started', confidence: 0.97 },
      ],
      redFlags: [
        'Severe or sudden headache unlike previous ones',
        'Blurred or double vision',
        'Blood pressure reading above 180',
        'Weakness or numbness on one side of body',
      ],
      monitoringSchedule: [
        { id: 'ms1', question: 'Good morning! Did you take your blood pressure medicines today?', frequency: 'daily', time: '08:00' },
        { id: 'ms2', question: 'Any headache or vision changes today?', frequency: 'daily', time: '08:05' },
      ],
      diagnosis: 'Hypertensive Emergency',
      confidence: 0.97,
      approvedAt: '2026-02-19T10:15:00Z',
    },
    checkIns: [
      {
        id: 'ci-004',
        timestamp: '2026-02-21T07:55:00Z',
        message: 'Yes doctor, took both medicines. Feeling fine, no headache.',
        riskScore: 'green',
        triggeredFlags: [],
        botResponse: 'Excellent work, Emeka! Keep it up — your consistency is what will keep you safe. Talk tomorrow.',
      },
      {
        id: 'ci-005',
        timestamp: '2026-02-20T08:02:00Z',
        message: 'Taken. All good today.',
        riskScore: 'green',
        triggeredFlags: [],
        botResponse: 'Great! Staying on track, well done. See you tomorrow.',
      },
    ],
    alerts: [],
  },
  {
    id: 'p-004',
    name: 'Aisha Musa',
    age: 72,
    diagnosis: 'Pneumonia — Awaiting Signal',
    admittedDate: '2026-02-19',
    dischargedDate: '2026-02-21',
    doctorId: 'dr-001',
    riskScore: 'unmonitored',
    phoneNumber: '+2348045678901',
    lastCheckIn: null,
    signal: null,
    checkIns: [],
    alerts: [],
  },
]

export const DEMO_CREDENTIALS = {
  email: 'dr.kunle@lagos.hospital.ng',
  password: 'demo2026',
}

export const DEMO_DOCTOR = {
  id: 'dr-001',
  name: 'Dr. Kunle Hassan',
  specialty: 'Internal Medicine & Cardiology',
  hospital: 'Lagos University Teaching Hospital',
  email: 'dr.kunle@lagos.hospital.ng',
}
