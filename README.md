# Toju

**Proactive AI Health Partnership – Turning Every Smartphone into a Clinical Early Warning System**

[Demo URL](https://toju-ts.vercel.app/)

Toju is an AI-driven clinical communication and triage SaaS designed specifically to eliminate the post-discharge care blind spot.

Rather than forcing patients to overcome "app fatigue" by downloading standalone healthcare portals, Toju leverages ubiquitous messaging infrastructure to continuously ingest biometric and qualitative health data. Its proprietary AI reasoning engine applies dynamic risk tolerance to this data, intelligently routing non-critical adherence alerts to a patient's community proxy (Next of Kin). It reserves direct clinical escalation for verified, high-risk anomalies, pushing structured data to hospital dashboards only when physical intervention is required.

Ultimately, Toju translates raw patient habits into actionable triage insights—preventing clinical emergencies for the patient and financial penalties for the provider, without contributing to clinician EMR burnout.

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [Usage](#usage)
  - [For Providers](#for-providers)
  - [For Patients](#for-patients)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## The Problem

Modern healthcare is reactive. Once a patient leaves the hospital, they enter a communication void:

- **Data Garbage:** EMRs are bloated with billing codes and copy‑pasted notes that bury the actual care plan.
- **Follow‑up Failure:** Patients receive 20‑page printouts they never read.
- **Reactive Intervention:** Doctors only learn of trouble when the patient shows up in the ER. There is **no early warning system** in the home.

---

## The Solution

Toju creates a **closed loop** between the hospital and the home:

- **Data → Prevention:** It synthesises messy EMR data into a clear “Clinical Signal” and uses it to monitor the patient daily.
- **AI as a Health Partner:** A WhatsApp‑based interface (no app download) that follows the doctor’s specific orders – guiding, reminding, and listening in the patient’s own language.
- **Provider as a Device:** The patient’s existing smartphone becomes a continuous monitoring tool that alerts the hospital **before** a crisis happens.

---

## Key Features

### For Patients – The “Health Partner” Journey

- **Instant Onboarding:** Upon discharge, the patient receives a welcome WhatsApp message in their preferred language (English, Pidgin, Yoruba, etc.).
- **Daily Check‑ins:** A friendly chat begins each day – *“Good morning, Papa. Did you remember your heart medicine today? How are you feeling?”*
- **Multi‑Modal Input:**
  - **The Tapper:** One‑tap buttons for simple responses (Taken).
  - **The Talker:** Voice notes for those who prefer to speak – *“I took it, but my legs feel a bit swollen today.”*
- **Smart Analysis & Guidance:** The AI instantly compares symptoms against the doctor’s orders and replies with micro‑guidelines – *“Swelling can be important for your heart. I’ve sent a note to Dr. Kunle. Please keep your legs elevated for now.”*

### For Providers – The “Command Center” Dashboard

- **One‑Click Patient Sync:** Doctors paste the messy EMR discharge note into the dashboard; AI extracts the “Signal” (medications, diagnosis, risk factors).
- **AI‑Powered Triage Dashboard:** All assigned patients are automatically sorted by a **Predictive Risk Score**:
  - **Red (High Risk):** Missed medications + reported red‑flag symptoms.
  - **Yellow (Trending):** Inconsistent adherence.
  - **Green (Stable):** Following the plan perfectly.
- **Real‑Time Alerts:** Critical symptoms (e.g., “swollen legs”) trigger a "red" alert in the hospital or doctor's dashboard.
- **One‑Click Intervention:** The doctor reviews the signal and can immediately **Schedule Telehealth** or **Adjust Medication** – the bot relays the update to the patient, or call the patient's loved one or guardian; closing the loop.

---

## How It Works

```mermaid
graph LR
    A[Doctor pastes EMR note] --> B[AI extracts Clinical Signal]
    B --> C[WhatsApp Bot interacts with Patient daily]
    C --> D[Patient responds via text/voice]
    D --> E[AI analyses symptoms & adherence]
    E --> F{Red Flag?}
    F -- Yes --> G[Alert on Doctor's Dashboard]
    G --> H[Doctor reviews & intervenes]
    H --> I[Bot relays updated instructions]
    I --> C
    F -- No --> J[Update patient risk score]
    J --> C
