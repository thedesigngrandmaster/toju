# Toju — AI-Powered Post-Discharge Patient Monitoring

> **Hackathon Theme: Data to Prevention · AI as a Partner**

> "Toju" means *"take care of this"* in Yoruba. That is exactly what the system does — it takes care of patients after the hospital can no longer watch over them.

---

## The Problem Is Not Just the Discharge Gap

Everyone knows about readmission rates. What nobody talks about is **the information blackout** that causes them.

A patient is treated, stabilised, and discharged. The doctor moves on to the next admission within minutes. The patient goes home. And then — silence.

No data flows back. Not because the patient doesn't have concerns, but because there is no channel for those concerns to reach anyone who can act on them. When something goes wrong at home, the patient's only options are to travel back to a hospital (often hours away) or wait and hope.

By the time the hospital sees that patient again, a preventable complication has become an emergency admission.

**This is not a treatment problem. It is a data problem.**

- Readmission rates at Nigerian tertiary hospitals exceed **15%** within 30 days of discharge
- **80% of post-discharge complications** show early warning symptoms in the 24–48 hours before crisis
- Doctors have no infrastructure to receive those signals — not because of negligence, but because the tools don't exist
- The patient already has a smartphone. The doctor already has a dashboard. **Nothing connects them.**

---

## The Solution: Close the Loop

Most healthtech responses to this problem build a **one-way street**: hospital sends reminders to patient. That is a glorified notification system. It does not prevent anything.

Toju is built around a single insight: **prevention requires a return signal**.

You have to make the patient's reply — their words, in their language, from their phone — flow back through an AI that understands their clinical context and surface the risk to the doctor before it becomes a crisis.

That is the loop. That is prevention.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        THE TOJU LOOP                                │
│                                                                     │
│   Doctor               System                      Patient          │
│     │                    │                              │           │
│     ├── Paste EMR ──────►│                              │           │
│     │                    ├── Gemini extracts signal     │           │
│     │◄── Review ─────────┤                              │           │
│     ├── Approve ────────►│                              │           │
│     │                    ├── WhatsApp: "Hello..." ─────►│           │
│     │                    │                              │           │
│     │              [7 AM daily]                         │           │
│     │                    ├── "How are you feeling?" ───►│           │
│     │                    │◄── "chest feels tight" ──────┤           │
│     │                    │                              │           │
│     │                    ├── Gemini: Risk = RED         │           │
│     │                    ├── Alert fired                │           │
│     │◄── RED ALERT ──────┤                              │           │
│     │                    ├── "Go to hospital now" ─────►│           │
│     │                    │                              │           │
└─────────────────────────────────────────────────────────────────────┘
```

**The left side** (Doctor → Patient) is a notification system.
**The right side** (Patient → AI → Doctor) is **prevention**.

Toju builds both — and the right side is what wins.

---

## What Is Already Built (The MVP)

### EMR Signal Extraction — Hospital → AI
The doctor pastes raw discharge notes into Toju. Gemini AI reads the clinical text and extracts a structured **Clinical Signal** in seconds:

- Primary diagnosis
- Every medication with dose, frequency, and status (started / continued / stopped / adjusted), each with an AI confidence score
- Clinical red flags to watch for — the specific symptoms that should trigger an alert
- A personalised daily check-in question for this patient's specific condition
- A plain-language patient summary (5th-grade reading level, in the patient's language)
- Patient age extracted from notes

The doctor sees the extracted signal side-by-side with the raw notes in a split review panel, edits anything, and approves. One click. The AI did the clinical structuring work.

### ✅ Outbound WhatsApp Bot — System → Patient
The moment the signal is approved:
1. The patient receives a WhatsApp message from Toju introducing itself
2. Every morning at **7 AM**, the personalised check-in question goes out automatically
3. If the patient does not reply by 10 AM, a **missed check-in alert** fires and their risk escalates automatically

The bot uses `whatsapp-web.js` — a real WhatsApp session, not the Business API. No approval process. No per-message cost. Works on any existing WhatsApp number.

### ✅ The Return Loop — Patient → AI → Doctor
When the patient replies via WhatsApp:

1. Gemini reads the message **in the context of their specific clinical situation** — it knows their diagnosis, their medications, and exactly which symptoms were flagged as danger signs by their discharging doctor
2. It outputs a risk classification (`red` / `yellow` / `green`), the specific red flags that were triggered, and an empathetic bot response in the patient's language
3. The check-in is recorded in the database with full AI analysis
4. If the risk is `red`, an alert is fired immediately — the doctor sees it on their dashboard
5. The bot replies to the patient: if green, a care tip; if yellow, gentle guidance; if red, a clear instruction to seek emergency help

### ✅ Live Clinical Dashboard — AI → Doctor
The doctor's dashboard shows every patient sorted by risk. Red patients surface to the top. Unresolved alerts appear in a banner. The dashboard polls every 30 seconds for updates.

---

## Architecture

```
selora/
├── frontend/                    # Next.js provider dashboard
│   ├── app/                     # App Router pages + layout
│   ├── views/
│   │   ├── LandingView.tsx
│   │   ├── DashboardView.tsx    # Patient table + alert banner, 30s polling
│   │   ├── PatientDetailView.tsx # Check-in history + alert timeline
│   │   ├── SignalView.tsx       # Signal extraction + split review panel
│   │   └── auth/LoginView.tsx
│   ├── components/
│   │   ├── provider/            # Sidebar, PatientTable, AlertBanner, SignalSummary
│   │   └── signal/              # NotesUploadArea (AI loading overlay), SplitReview
│   ├── context/PatientsContext  # Global state + data fetching
│   └── lib/api.ts               # Typed fetch client
│
└── backend/                     # Node.js + Express API
    └── src/
        ├── config/              # env.ts, db.ts
        ├── models/              # Hospital, Doctor, Patient, CheckIn, Alert
        ├── controllers/         # auth, patients, checkin, alerts
        ├── services/
        │   ├── ai.ts            # Gemini: extractSignal + analyzeCheckIn
        │   └── whatsapp.ts      # Bot: send, receive, handle inbound
        ├── jobs/cron.ts         # 7 AM dispatch + 10 AM missed check-in
        ├── middleware/auth.ts
        └── routes/index.ts
```

---

## Tech Stack

### Frontend
| Technology | Role |
|---|---|
| **Next.js 16** (App Router) | Framework, SSR |
| **React 19** | UI library |
| **TypeScript** | End-to-end type safety |
| **Tailwind CSS v4** | Styling |
| **NextUI v2** | Component system |
| **Framer Motion** | Animations |
| **Formik + Yup** | Form handling and validation |
| **React Hot Toast** | Notifications |
| **Lucide React** | Icons |

### Backend
| Technology | Role |
|---|---|
| **Node.js + Express** | API server |
| **TypeScript** | Type safety |
| **MongoDB + Mongoose** | Database and ODM |
| **JWT + bcrypt** | Auth — access tokens + hashed refresh tokens |
| **cookie-parser** | Secure HttpOnly refresh cookie |
| **node-cron** | 7 AM dispatch, 10 AM missed check-in |

### AI — Google Gemini

Gemini is the core intelligence layer. It is used for two distinct tasks:

| Task | Model | Prompt Role | Output |
|---|---|---|---|
| **EMR Signal Extraction** | Gemini 2.5 Flash | Clinical Data Extractor | Structured JSON: diagnosis, medications, red flags, monitoring schedule, patient summary |
| **Check-in Triage** | Gemini 2.5 Flash | Triage Nurse | `{ riskScore, triggeredFlags[], botResponse }` |

The triage prompt is context-aware: Gemini receives the patient's diagnosis, their full medication list, and the specific red flags their doctor marked — before it reads the patient's message. This is not generic sentiment analysis. It is personalised clinical triage at scale.

### WhatsApp Bot
| Technology | Role |
|---|---|
| **whatsapp-web.js** | WhatsApp Web automation via Puppeteer |
| **Chromium** (Docker) | Headless browser for the session |
| **LocalAuth** | Persistent session — survives server restarts |
| **qrcode-terminal** | QR display in logs for initial setup |

### Infrastructure
| Technology | Role |
|---|---|
| **Railway** | Backend (Docker, persistent disk for WhatsApp session) |
| **Vercel** | Frontend |
| **MongoDB Atlas** | Cloud database |

---

## Data Models

### Patient
```typescript
{
  doctorId, hospitalId,
  name, age, phoneNumber,
  language: 'english' | 'pidgin' | 'yoruba' | 'igbo' | 'hausa',
  diagnosis, admittedDate, dischargedDate,
  riskScore: 'red' | 'yellow' | 'green' | 'unmonitored',
  lastCheckIn: Date | null,
  checkInToken: string,
  signal: {
    patientSummary: string,        // plain-language, patient-facing
    rawNotes: string,              // original EMR text
    medications: [{
      name, dose, frequency,
      status: 'continued' | 'started' | 'stopped' | 'adjusted',
      confidence: number           // AI confidence 0–1
    }],
    redFlags: string[],            // exact trigger conditions for RED
    monitoringSchedule: [{
      question: string,            // what the bot asks every morning
      frequency: 'daily' | 'weekly' | 'as_needed',
      time: string | null
    }],
    diagnosis: string,
    confidence: number,
    approvedAt: Date | null,
    approvedBy: DoctorId | null
  }
}
```

### CheckIn
One record per patient WhatsApp reply — the core data asset of the return loop.
```typescript
{
  patientId, doctorId, timestamp,
  message: string,               // raw patient message
  riskScore: 'red' | 'yellow' | 'green',
  triggeredFlags: string[],      // which red flags Gemini matched
  botResponse: string            // what Toju replied to the patient
}
```

### Alert
Raised automatically — never manually. Two types:
```typescript
{
  patientId, doctorId, timestamp,
  type: 'red_flag' | 'missed_checkin',
  message: string,
  resolved: boolean,
  resolvedAt: Date | null
}
```

---

## AI Prompts

### Signal Extraction Prompt
Gemini is instructed to act as a **clinical AI assistant**. It receives raw EMR notes and is asked to return only valid JSON — no markdown, no explanation. The output schema includes age, patient summary, diagnosis, medications (with AI confidence per drug), red flags, and a monitoring schedule with specific WhatsApp-ready questions.

The AI assigns a `confidence` score to the whole extraction and to each medication individually — giving the doctor a signal of how much to trust each field before approving.

### Check-in Triage Prompt
Gemini receives:
- The patient's first name
- Their diagnosis
- Their full medication list (name, dose, frequency)
- The exact red flags their doctor specified at discharge
- The patient's raw WhatsApp message

It returns `{ riskScore, triggeredFlags[], botResponse }`.

The `botResponse` follows strict rules: never opens with "Hi [name], thanks for your message." References the patient's actual words. If green: gives one actionable care tip. If yellow: flags the concern and advises. If red: tells them clearly to seek emergency help immediately.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/auth/login` | Returns access token + sets refresh cookie |
| `POST` | `/v1/auth/refresh` | Rotates access token from refresh cookie |
| `POST` | `/v1/auth/logout` | Invalidates refresh token |
| `GET` | `/v1/doctors/me` | Logged-in doctor profile |

### Patients
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/patients` | List with risk filter, search, pagination |
| `GET` | `/v1/patients/:id` | Detail with check-ins and alerts |
| `POST` | `/v1/patients` | Register new patient |
| `POST` | `/v1/patients/:id/signal` | AI extraction from EMR notes |
| `PATCH` | `/v1/patients/:id/signal/approve` | Approve signal, dispatch first WhatsApp |
| `PATCH` | `/v1/patients/:id/risk` | Manual risk override |

### Monitoring
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/patients/:id/checkins` | Paginated check-in history |
| `GET` | `/v1/alerts` | All alerts for logged-in doctor |
| `PATCH` | `/v1/alerts/:id/resolve` | Resolve an alert |

### WhatsApp
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/whatsapp/qr` | QR for initial bot auth |
| `GET` | `/v1/whatsapp/status` | Bot ready state |

---

## Local Development

### Prerequisites
- Node.js 20+, pnpm
- MongoDB Atlas connection string
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))
- A WhatsApp number for the bot

### Backend
```bash
cd backend
cp .env.example .env
# fill in: MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, FRONTEND_URL

pnpm install
pnpm dev
# QR code prints in terminal — scan with your WhatsApp to activate the bot
```

### Frontend
```bash
cd frontend
# create .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:4000/v1

pnpm install
pnpm dev
```

### Seed
```bash
cd backend && pnpm seed
```

---

## Deployment

### Backend → Railway (required for WhatsApp bot)
The bot needs a persistent process with a real browser. Serverless platforms (Vercel, Lambda) cannot run it.

1. Connect Railway → GitHub repo, set root to `backend`, builder to Dockerfile
2. Set env vars: `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL`, `NODE_ENV=production`, `CHROME_PATH=/usr/bin/chromium`, `JWT_EXPIRES_IN=7d`
3. Add a persistent disk at `/app/.wwebjs_auth` (stores WhatsApp session across deploys)
4. After deploy: check Railway logs for the QR code, scan once with your phone

### Frontend → Vercel
1. Root directory: `frontend`
2. Env var: `NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app/v1`

---

## Roadmap — Closing the Loop Further

The core prevention loop is live. What we build next makes it faster, smarter, and more complete.

### Real-time Dashboard Alerts
Replace 30-second polling with WebSocket. When a patient's message triggers a red risk score, the doctor's dashboard updates in under a second — the patient row flashes red and floats to the top of the table. This is the demo moment: a patient texts "my chest feels tight," and within 2 seconds the doctor sees a red alert without touching their keyboard.

### Conversation Memory & Trend Detection
Store the last N check-ins per patient. Feed them to Gemini as context before analysing the next reply. A patient saying "a little tired" once is noise. A patient saying it three days in a row, with a medication that causes fatigue as a warning sign, is a signal. Trend-aware triage cannot be done with a single message — it requires memory.

### Multilingual Bot Responses
The `language` field is already stored on every patient. Prompt Gemini to respond **in the patient's language** — Yoruba, Hausa, Igbo, Pidgin — so the patient receives clinical guidance in the language they think in, not the language of the hospital form. This is critical for informed self-care in communities where English is not the first language.

### Caregiver Escalation Loop
Many patients are elderly and non-smartphone users. A secondary `caregiverPhone` field: if the patient does not reply within 3 hours of the morning check-in, the bot automatically texts the caregiver — *"[Name] has not responded to today's health check. Please check on them."* The caregiver becomes part of the monitoring network.

### Discharge Summary via WhatsApp
At the moment of signal approval, generate a patient-friendly one-page discharge summary from the Clinical Signal — medications, what to watch for, emergency contact — and deliver it as a PDF directly to the patient's WhatsApp. The patient leaves the hospital with their full discharge instructions in their pocket, in their language.

### Doctor Mobile Dashboard
Alerts on a desktop the doctor isn't sitting at are useless. A responsive mobile-first alert view so doctors can review and resolve red-flag notifications from their phone while on rounds.

---

## The Hackathon Case

**Theme: Data to Prevention**

The EMR system already contains the clinical intelligence doctors spend years learning. It describes exactly what this patient's danger signs are. Toju extracts that intelligence from text, converts it into a monitoring protocol, and then acts on it — automatically, at scale, with no additional doctor time.

The data was always there. Toju is the system that puts it to work.

**Theme: AI as a Partner**

Gemini does not replace clinical judgment — it extends it. The doctor defines the red flags. The doctor approves the signal. The AI then applies that clinical judgment at 3 AM on a weekend when the doctor is not available, reading a patient's WhatsApp message and knowing — based on what that specific doctor said at discharge — whether "chest tightness" in this patient, on this medication, with this diagnosis, is an emergency.

That is AI as a clinical partner.

---

## Impact at Scale

A hospital discharging 50 patients per week — with Toju:

| Metric | Without Toju | With Toju |
|---|---|---|
| Post-discharge contact rate | ~0% | 100% (automated) |
| Red-flag detection time | Days (readmission) | Hours (reply analysis) |
| Doctor time per monitored patient | 15 min follow-up call | 30 sec alert review |
| Missed check-in visibility | Never | Same morning, automated |
| Language accessibility | Low | 5 Nigerian languages |
| Infrastructure cost | Call centre + nurses | One WhatsApp number |
| Data generated per patient | None | Full check-in history, risk trend, triggered flags |

Every check-in reply is a data point. Aggregated across a hospital, this is the first dataset that shows what actually happens to patients after they go home — and where the care system is failing them.

---

## License

MIT
