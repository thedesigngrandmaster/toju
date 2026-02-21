export type RiskScore = 'red' | 'yellow' | 'green' | 'unmonitored'

export type Medication = {
  id: string
  name: string
  dose: string
  frequency: string
  status: 'continued' | 'started' | 'stopped' | 'adjusted'
  confidence: number
}

export type MonitoringItem = {
  id: string
  question: string
  frequency: 'daily' | 'weekly' | 'as_needed'
  time: string | null
}

export type ClinicalSignal = {
  patientSummary: string
  medications: Medication[]
  redFlags: string[]
  monitoringSchedule: MonitoringItem[]
  diagnosis: string
  rawNotes: string
  confidence: number
  approvedAt: string | null
}

export type CheckIn = {
  id: string
  timestamp: string
  message: string
  riskScore: RiskScore
  triggeredFlags: string[]
  botResponse: string
}

export type Alert = {
  id: string
  timestamp: string
  type: 'red_flag' | 'missed_checkin'
  message: string
  resolved: boolean
}

export type PatientLanguage = 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa'

export type Patient = {
  id: string
  name: string
  age: number
  diagnosis: string
  admittedDate: string
  dischargedDate: string
  doctorId: string
  riskScore: RiskScore
  signal: ClinicalSignal | null
  checkIns: CheckIn[]
  alerts: Alert[]
  lastCheckIn: string | null
  phoneNumber: string
  language: PatientLanguage
}

export type Doctor = {
  id: string
  name: string
  specialty: string
  hospital: string
  email: string
}
