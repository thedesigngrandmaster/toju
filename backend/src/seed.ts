import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'
dotenv.config()
import { Hospital } from './models/Hospital'
import { Doctor } from './models/Doctor'
import { Patient } from './models/Patient'
import { CheckIn } from './models/CheckIn'
import { Alert } from './models/Alert'
async function seed() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }
  await mongoose.connect(uri)
  console.log('[SEED] Connected to MongoDB')
  await Promise.all([
    Hospital.deleteMany({}),
    Doctor.deleteMany({}),
    Patient.deleteMany({}),
    CheckIn.deleteMany({}),
    Alert.deleteMany({}),
  ])
  console.log('[SEED] Cleared existing data')
  const hospital = await Hospital.create({
    name: 'Lagos University Teaching Hospital',
    address: 'Idi-Araba, Surulere, Lagos, Nigeria',
  })
  console.log('[SEED] Hospital created:', hospital.name)
  const passwordHash = await bcrypt.hash('demo2026', 12)
  const doctor = await Doctor.create({
    name: 'Dr. Kunle Hassan',
    email: 'dr.kunle@lagos.hospital.ng',
    passwordHash,
    specialty: 'Internal Medicine & Cardiology',
    hospitalId: hospital._id,
  })
  console.log('[SEED] Doctor created:', doctor.email)
  const p1 = await Patient.create({
    name: 'Emmanuel Adebayo',
    age: 68,
    phoneNumber: '+2348012345678',
    diagnosis: 'Congestive Heart Failure',
    admittedDate: new Date('2026-02-10'),
    dischargedDate: new Date('2026-02-18'),
    riskScore: 'red',
    checkInToken: uuidv4(),
    doctorId: doctor._id,
    hospitalId: hospital._id,
    lastCheckIn: new Date('2026-02-21T08:14:00Z'),
    signal: {
      rawNotes: 'Patient: Emmanuel Adebayo, 68M. Admitted 10/02/2026 with progressive dyspnea and bilateral pedal edema. Dx: Congestive Heart Failure (EF 35%). Started on Lisinopril 10mg OD, continued Furosemide 40mg OD (morning). Stopped Amlodipine. Discharged with education on fluid restriction and daily weights.',
      patientSummary: 'You were treated for a heart condition called Congestive Heart Failure. Your heart is not pumping as strongly as it should. You are taking medicines to help your heart work better and remove extra fluid from your body. It is very important to take all your medicines, watch your weight daily, and avoid eating too much salt.',
      diagnosis: 'Congestive Heart Failure (EF 35%)',
      overallConfidence: 0.95,
      medications: [
        { name: 'Furosemide', dose: '40mg', frequency: 'Once daily (morning)', status: 'continued', confidence: 0.97 },
        { name: 'Lisinopril', dose: '10mg', frequency: 'Once daily', status: 'started', confidence: 0.95 },
        { name: 'Amlodipine', dose: '—', frequency: '—', status: 'stopped', confidence: 0.96 },
      ],
      redFlags: [
        { description: 'Sudden weight gain more than 2kg in one day' },
        { description: 'Increasing swelling in legs or ankles' },
        { description: 'Shortness of breath while resting' },
        { description: 'Chest pain or tightness' },
      ],
      monitoringItems: [
        { question: 'Did you take all your medicines this morning?', frequency: 'daily', time: '08:00' },
        { question: 'How are you feeling? Any leg swelling today?', frequency: 'daily', time: '08:05' },
      ],
      approvedAt: new Date('2026-02-18T14:30:00Z'),
    },
  })
  await CheckIn.create({
    patientId: p1._id,
    message: 'I took the medicine. Feeling okay today, no swelling.',
    riskScore: 'green',
    triggeredFlags: [],
    botResponse: 'That is wonderful to hear, Papa Emmanuel! Keep taking your medicines every morning. We are happy you are doing well. 💙',
    timestamp: new Date('2026-02-20T08:10:00Z'),
  })
  await CheckIn.create({
    patientId: p1._id,
    message: 'I took the medicine but my legs are very swollen this morning',
    riskScore: 'red',
    triggeredFlags: ['Increasing swelling in legs or ankles'],
    botResponse: 'Papa Emmanuel, leg swelling is something we take seriously for your heart. I have already sent a note to Dr. Kunle. Please sit with your legs raised on a pillow. Do not eat or drink too much water right now.',
    timestamp: new Date('2026-02-21T08:14:00Z'),
  })
  await Alert.create({
    patientId: p1._id,
    doctorId: doctor._id,
    type: 'red_flag',
    message: 'Patient reported increasing leg swelling — possible CHF exacerbation.',
    timestamp: new Date('2026-02-21T08:14:00Z'),
  })
  const p2 = await Patient.create({
    name: 'Fatima Bello',
    age: 45,
    phoneNumber: '+2348023456789',
    diagnosis: 'Diabetic Ketoacidosis',
    admittedDate: new Date('2026-02-12'),
    dischargedDate: new Date('2026-02-17'),
    riskScore: 'yellow',
    checkInToken: uuidv4(),
    doctorId: doctor._id,
    hospitalId: hospital._id,
    lastCheckIn: new Date('2026-02-20T09:00:00Z'),
    signal: {
      rawNotes: 'Patient: Fatima Bello, 45F. Admitted 12/02/2026 with DKA. Blood glucose on admission: 450mg/dL. Started insulin glargine 20 units nightly, metformin 500mg BD. Education on glucose monitoring and dietary changes.',
      patientSummary: 'You were treated for a serious complication of diabetes called DKA. Your blood sugar was very high. You are now taking insulin and metformin to keep it under control. Please check your blood sugar every day and eat regular meals.',
      diagnosis: 'Diabetic Ketoacidosis (Type 2 DM)',
      overallConfidence: 0.92,
      medications: [
        { name: 'Insulin Glargine', dose: '20 units', frequency: 'Once daily (bedtime)', status: 'started', confidence: 0.94 },
        { name: 'Metformin', dose: '500mg', frequency: 'Twice daily', status: 'started', confidence: 0.93 },
      ],
      redFlags: [
        { description: 'Feeling very thirsty or urinating too much' },
        { description: 'Nausea, vomiting, or stomach pain' },
        { description: 'Breath smells fruity or sweet' },
        { description: 'Confusion or feeling very sleepy' },
      ],
      monitoringItems: [
        { question: 'Did you take your insulin and metformin today?', frequency: 'daily', time: '08:00' },
        { question: 'What was your blood sugar reading this morning?', frequency: 'daily', time: '08:05' },
      ],
      approvedAt: new Date('2026-02-17T10:00:00Z'),
    },
  })
  await CheckIn.create({
    patientId: p2._id,
    message: 'I took my medicine. Blood sugar is 180 this morning.',
    riskScore: 'green',
    triggeredFlags: [],
    botResponse: 'Thank you, Fatima! 180 mg/dL is much better than before. Keep monitoring and taking your medicines regularly. You are doing great! 💙',
    timestamp: new Date('2026-02-20T09:00:00Z'),
  })
  await Alert.create({
    patientId: p2._id,
    doctorId: doctor._id,
    type: 'missed_checkin',
    message: 'Fatima Bello has not responded to today\'s check-in.',
    timestamp: new Date('2026-02-21T10:00:00Z'),
  })
  const p3 = await Patient.create({
    name: 'Chukwuemeka Obi',
    age: 55,
    phoneNumber: '+2348034567890',
    diagnosis: 'Hypertensive Crisis',
    admittedDate: new Date('2026-02-14'),
    dischargedDate: new Date('2026-02-19'),
    riskScore: 'green',
    checkInToken: uuidv4(),
    doctorId: doctor._id,
    hospitalId: hospital._id,
    lastCheckIn: new Date('2026-02-21T08:30:00Z'),
    signal: {
      rawNotes: 'Patient: Chukwuemeka Obi, 55M. Admitted 14/02/2026 with BP 220/130. Dx: Hypertensive Crisis. Started on Amlodipine 10mg OD, Losartan 50mg OD. BP at discharge: 140/90.',
      patientSummary: 'You were treated for very high blood pressure that needed urgent care. You are now taking medicines to keep your blood pressure under control. It is very important to take your medicines every day, reduce salt in your food, and avoid stress.',
      diagnosis: 'Hypertensive Crisis (BP 220/130 on admission)',
      overallConfidence: 0.93,
      medications: [
        { name: 'Amlodipine', dose: '10mg', frequency: 'Once daily', status: 'started', confidence: 0.95 },
        { name: 'Losartan', dose: '50mg', frequency: 'Once daily', status: 'started', confidence: 0.94 },
      ],
      redFlags: [
        { description: 'Severe headache that does not go away' },
        { description: 'Blurred vision or seeing double' },
        { description: 'Chest pain or difficulty breathing' },
        { description: 'Nosebleed that won\'t stop' },
      ],
      monitoringItems: [
        { question: 'Did you take your blood pressure medicines today?', frequency: 'daily', time: '08:00' },
        { question: 'How is your head feeling today? Any headaches?', frequency: 'daily', time: '08:05' },
      ],
      approvedAt: new Date('2026-02-19T11:00:00Z'),
    },
  })
  await CheckIn.create({
    patientId: p3._id,
    message: 'Good morning, I took my medicine. No headache today!',
    riskScore: 'green',
    triggeredFlags: [],
    botResponse: 'Wonderful news, Chukwuemeka! No headache is a great sign. Keep taking your medicines and eating less salt. You are doing very well! 💙',
    timestamp: new Date('2026-02-20T08:20:00Z'),
  })
  await CheckIn.create({
    patientId: p3._id,
    message: 'Took all my medication. Feeling fine today.',
    riskScore: 'green',
    triggeredFlags: [],
    botResponse: 'Great to hear you are feeling fine! Keep up the good work. Remember to check your blood pressure if you can. 💙',
    timestamp: new Date('2026-02-21T08:30:00Z'),
  })
  await Patient.create({
    name: 'Aisha Musa',
    age: 72,
    phoneNumber: '+2348045678901',
    diagnosis: 'Community-Acquired Pneumonia',
    admittedDate: new Date('2026-02-19'),
    dischargedDate: new Date('2026-02-21'),
    riskScore: 'unmonitored',
    checkInToken: uuidv4(),
    doctorId: doctor._id,
    hospitalId: hospital._id,
  })
  console.log('[SEED] ✅ All seed data created successfully!')
  console.log(`[SEED] Login → email: dr.kunle@lagos.hospital.ng / password: demo2026`)
  console.log(`[SEED] 4 patients: Emmanuel (red), Fatima (yellow), Chukwuemeka (green), Aisha (unmonitored)`)
  await mongoose.disconnect()
  process.exit(0)
}
seed().catch(err => {
  console.error('[SEED] Error:', err)
  process.exit(1)
})
