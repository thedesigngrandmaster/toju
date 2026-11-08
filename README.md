# Toju — Offline-First Post-Discharge Monitoring

> “Toju” means *“take care of this”* in Yoruba. Toju keeps watching a patient after the hospital stops watching them.

Toju is a **local-first PWA for clinicians** and a **durable WhatsApp bridge for patients**. Clinicians review AI-extracted discharge signals, triage daily check-ins, resolve alerts, and write notes even when the network drops. Patient messages are persisted before triage, and every outbound WhatsApp message goes through a durable server-side outbox.

**Hackathon theme:** *Data to Prevention · AI as a Partner*

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | **Vite + React 19 + TypeScript** |
| Styling | Tailwind CSS v4 |
| Local data | **Dexie / IndexedDB** |
| Offline sync | Custom delta sync with a durable outbox |
| PWA | `vite-plugin-pwa` with an inject-manifest service worker |
| Backend | **Node.js + Express + TypeScript** |
| Database | **MongoDB + Mongoose** |
| AI | **Gemini 2.5 Flash** (`@google/genai`) with deterministic server rules as a fallback |
| WhatsApp | **whatsapp-web.js** (`LocalAuth`) |
| Workspace | **npm workspaces** (no pnpm, no Next.js) |

The old Next.js frontend and pnpm workspace have been removed. The root is a single npm workspace containing `frontend/` and `backend/`.

---

## Quick start

### Requirements

- Node.js **20+** (Node 22 recommended)
- npm **10+**
- MongoDB is optional for local development. A file-backed MongoDB fallback starts automatically when `MONGODB_URI` is not set.
- Chrome/Chromium is optional. WhatsApp stays disabled unless `WHATSAPP_ENABLED=true`.

### Install and run

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:4000**.

`npm run dev` starts:

- the Express API with `ts-node-dev`
- the Vite dev server with the `/v1` and `/health` proxy
- the development MongoDB fallback, if no real `MONGODB_URI` is configured

The first run of the fallback downloads MongoDB 4.4 and, on Linux x64 systems that only ship `libssl3`, a private copy of `libssl1.1`. These files are cached under `backend/.mongo-data/` and `backend/.mongo-libs/` and are gitignored. Data survives restarts.

To use a real database instead:

```bash
cp backend/.env.example backend/.env
# edit backend/.env and set MONGODB_URI
```

A real `MONGODB_URI` always wins over the fallback.

### Seed demo data

```bash
npm run seed
```

Demo credentials:

```text
Email:    dr.kunle@lagos.hospital.ng
Password: demo2026
```

The seed creates one hospital, one doctor, four patients, check-ins, alerts, and clinical notes. Running it again replaces the demo collections.

### Production build

```bash
npm run build
```

This type-checks the frontend, builds the PWA, and compiles the backend. The PWA output is `frontend/dist/` (including `dist/sw.js` and `dist/manifest.webmanifest`); the API output is `backend/dist/`.

---

## Root scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the API, Vite, and the dev Mongo fallback when needed |
| `npm run dev:api` | Starts only the API (requires a reachable MongoDB) |
| `npm run dev:web` | Starts only the Vite frontend |
| `npm run build` | Builds frontend and backend |
| `npm run typecheck` | Type-checks the frontend and compiles the backend |
| `npm run seed` | Seeds the demo dataset |
| `npm start` | Runs the compiled backend (`backend/dist/index.js`) |
| `npm run preview` | Serves the built PWA with `vite preview` |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | Use `production` on a server |
| `FRONTEND_URL` | `http://localhost:5173` | Comma-separated CORS origins |
| `MONGODB_URI` | unset | Real MongoDB URI; unset enables the dev fallback |
| `JWT_SECRET` | dev fallback | Set a long random value in production |
| `JWT_EXPIRES_IN` | `7d` | Access-token lifetime |
| `GEMINI_API_KEY` | unset | Without it, triage uses the server rule engine |
| `SYNC_PAGE_SIZE` | `300` | Maximum records per delta-sync page |
| `WHATSAPP_ENABLED` | `false` | Set `true` only with Chrome/Chromium available |
| `WHATSAPP_AUTH_PATH` | `.wwebjs_auth` | Persistent WhatsApp session directory |
| `WHATSAPP_CHROME_PATH` | unset | Explicit Chrome/Chromium executable |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | empty | Empty uses the Vite proxy in dev. Set to the API origin in production. |
| `VITE_API_PROXY` | `http://localhost:4000` | Dev proxy target |

---

## How the offline-first model works

### Local writes

Every clinician action is written to IndexedDB first:

1. The entity is updated optimistically.
2. A mutation is appended to the durable `outbox` table.
3. An audit entry is appended locally.
4. The UI re-renders from Dexie via `useLiveQuery`.
5. The sync loop pushes the outbox when a connection is available.

The local database (`frontend/src/lib/db.ts`) contains:

```text
patients  checkIns  alerts  notes  outbox  aiQueue  audit  conflicts  meta
```

### Push then pull

`frontend/src/lib/sync-core.ts` performs:

1. **Push** pending outbox operations in priority order.
2. **Pull** server changes since the last cursor (`lastSyncAt`).
3. Merge remote changes, preserving local clinician edits.
4. Record conflicts locally instead of silently losing work.
5. Retry transient failures with backoff; reject permanently invalid operations.

Outbox priorities keep clinically urgent work first:

| Operation | Priority |
| --- | --- |
| RED alert / critical triage | 100 |
| Signal approval | 60 |
| Yellow triage | 40 |
| Manual WhatsApp message | 35 |
| Note | 15 |
| Patient creation | 10 |

### Idempotency and ordering

- Client-generated UUIDs are canonical. MongoDB `_id` is never exposed by the API.
- The server records every applied operation in a `SyncOperation` ledger keyed by `(doctorId, operationId)`.
- Replaying an operation returns `duplicate` and does not duplicate data.
- Out-of-order operations are rejected or retried; they are never silently dropped.
- Server writes increment `serverVersion`, which drives conflict detection.
- Clinician-local edits win when versions conflict; the conflict is retained for review.

### Offline AI

- Check-ins can be triaged locally with deterministic rules while offline.
- Cloud Gemini jobs are queued in `aiQueue` and retried when online.
- The server always has a rule-based fallback, so a missing `GEMINI_API_KEY` or Gemini outage still produces a RED/YELLOW/GREEN result.
- Every AI result stores provenance: model, prompt version, generation time, source, and confidence.

### Audit

The PWA keeps an append-only local audit log. The API also records server-side audit entries for clinical writes, triage, alert resolution, signal approval, and WhatsApp queueing. Audit failures never block clinical writes.

---

## WhatsApp pipeline

Patient messages must never be lost. The flow is:

```text
WhatsApp message
  → persist InboundMessage
  → local rule triage (RED fallback)
  → queue Gemini job if needed
  → create CheckIn and Alert
  → recompute patient risk
  → enqueue outbound reply
  → durable OutboundMessage sender with retries
```

Key properties:

- Inbound messages are persisted before triage.
- Outbound messages are persisted before sending.
- Sends are idempotent by key and retried with backoff.
- When `WHATSAPP_ENABLED=false`, messages remain queued instead of being lost.
- `whatsapp-web.js` uses `LocalAuth`, so the session survives restarts.
- RED alerts are created locally and synced; they do not depend on Gemini availability.

### Enabling WhatsApp locally

```bash
# backend/.env
WHATSAPP_ENABLED=true
WHATSAPP_CHROME_PATH=/usr/bin/chromium   # or your Chrome path
```

Then open the WhatsApp screen in the PWA and scan the QR code. If Chrome is unavailable, leave WhatsApp disabled; the rest of the app still works.

The Docker image installs Chromium and sets `WHATSAPP_CHROME_PATH=/usr/bin/chromium`.

---

## API

All routes are under `/v1` and require `Authorization: Bearer <token>` unless noted.

### Auth

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Email/password login; returns access token and refresh cookie |
| `POST` | `/auth/refresh` | Rotate the access token |
| `POST` | `/auth/logout` | Clear the refresh token |
| `GET` | `/doctors/me` | Current clinician profile |

### Offline sync

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/sync/push` | Apply an ordered list of client operations idempotently |
| `GET` | `/sync/pull?since=<iso>` | Pull patients, alerts, check-ins, and notes changed after a cursor |

### Clinical data

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/patients` | List patients (risk/search filters, pagination) |
| `GET` | `/patients/:id` | Patient detail with check-ins, alerts, and notes |
| `POST` | `/patients` | Register a patient |
| `POST` | `/patients/:id/signal` | Extract a signal from raw notes |
| `PATCH` | `/patients/:id/signal/approve` | Approve a care signal |
| `PATCH` | `/patients/:id/risk` | Override risk |
| `GET` | `/patients/:id/checkins` | Check-in history |
| `GET` | `/patients/:id/notes` | Clinical notes |
| `POST` | `/patients/:id/notes` | Add a note |
| `GET` | `/alerts` | List alerts |
| `PATCH` | `/alerts/:id/resolve` | Resolve an alert |

### AI and WhatsApp

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/ai/triage` | Gemini triage with rule fallback |
| `GET` | `/whatsapp/status` | Connection state and outbox counts |
| `GET` | `/whatsapp/qr` | QR code as a data URL |
| `GET` | `/whatsapp/outbox` | Recent outbound messages |
| `POST` | `/whatsapp/outbox/:id/retry` | Retry a failed message |
| `GET` | `/audit` | Server-side audit trail |
| `GET` | `/health` | Public health check |

---

## Project layout

```text
toju/
├── frontend/
│   ├── src/
│   │   ├── components/        UI primitives and layout
│   │   ├── context/           Auth, sync, and network providers
│   │   ├── hooks/             Live local data and PWA hooks
│   │   ├── lib/               Dexie schema, repository, sync, AI, audit, API client
│   │   ├── views/             Login, dashboard, patients, signals, alerts, WhatsApp, audit
│   │   ├── sw.ts              Custom service worker
│   │   └── types/             Shared domain and DTO types
│   ├── vite.config.ts
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/            Env, Mongo connection, dev Mongo fallback
│   │   ├── controllers/       Auth, patients, sync, AI, notes, audit, WhatsApp
│   │   ├── jobs/              Daily check-in and missed-check-in cron jobs
│   │   ├── middleware/        Auth, validation, errors
│   │   ├── models/            Patient, Alert, CheckIn, Note, audit, sync, messages
│   │   ├── routes/
│   │   ├── services/          AI, rules, outbound, WhatsApp, serializers, migrations
│   │   └── scripts/seed.ts
│   ├── Dockerfile
│   └── package.json
├── scripts/                   Dev bootstrap and seed wrappers
├── render.yaml
└── package.json               npm workspace root
```

---

## Development notes

### Local MongoDB fallback

When `MONGODB_URI` is unset and `NODE_ENV` is not `production`, the API starts a file-backed `mongodb-memory-server` instance. MongoDB 4.4 is used because it runs on older CPUs without AVX. The data directory is `backend/.mongo-data/`, so seeding and restarting the API keep the same data.

The fallback is development-only. Production always requires an explicit `MONGODB_URI`.

### Seed while the API is running

The seed script uses the same fallback URI file (`backend/.mongo-uri`) when it exists, so `npm run seed` can run against the API’s active development database.

### Offline simulation

Use the network controls in the PWA, or stop the API, to verify:

- patients, alerts, notes, and signals still render from IndexedDB
- edits and notes are queued in the outbox
- the sync badge shows pending work
- reconnecting pushes the queue and pulls the delta
- RED check-ins still create local alerts and rule-based triage results

---

## Deployment

### Docker (API)

```bash
docker build -t toju-api ./backend
docker run --rm -p 4000:4000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="..." \
  -e GEMINI_API_KEY="..." \
  -e FRONTEND_URL="https://your-pwa.example" \
  toju-api
```

The image includes Chromium. Set `WHATSAPP_ENABLED=true` and mount a persistent volume at `/app/.wwebjs_auth` to keep the WhatsApp session.

### Render

`render.yaml` defines:

- `toju-api`: Docker web service with a persistent disk for the WhatsApp session
- `toju-web`: static Vite build served from `frontend/dist`

Set `MONGODB_URI`, `GEMINI_API_KEY`, `FRONTEND_URL`, and `VITE_API_URL` in the Render dashboard.

### PWA installation

The production build includes a manifest and service worker. On Android, use **Install app** in Chrome. On iOS Safari, use **Share → Add to Home Screen**. The app shell and previously loaded data remain available offline.

---

## Verification checklist

```bash
npm install
npm run typecheck
npm run build
npm run seed
npm run dev
```

Then check:

- `http://localhost:4000/health` returns `{ "ok": true }`
- login with the demo credentials
- `GET /v1/sync/pull` returns the seeded patients, alerts, check-ins, and notes
- repeating a `POST /v1/sync/push` operation returns `duplicate`
- `/v1/ai/triage` returns RED with `server-fallback` provenance when `GEMINI_API_KEY` is unset
- `/v1/whatsapp/outbox` shows queued messages while WhatsApp is disabled
- `frontend/dist/sw.js` exists after `npm run build`

---

## Known limitations

- The dev MongoDB fallback downloads a MongoDB binary on first use. Production deployments should use a managed MongoDB or a local `mongod`.
- WhatsApp Web automation is inherently best-effort and depends on WhatsApp Web behavior. The durable outbox protects messages from loss, but delivery still requires a linked session.
- Gemini calls require network access and a valid API key. The deterministic rule engine is the safety net, not a replacement for clinician review.
- Local-first conflicts are preserved and marked; they are not automatically merged field-by-field.
