# Toju — Offline-First Post-Discharge Monitoring

> “Toju” means *“take care of this”* in Yoruba. Toju keeps watching a patient after the hospital stops watching them.

Toju is a **local-first PWA for clinicians** and a **durable monitoring API for patients**. Clinicians review AI-extracted discharge signals, triage daily check-ins, resolve alerts, and write notes even when the network drops. Patient messages are persisted before triage, and every outbound message goes through a durable server-side outbox.

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
| Database | **PostgreSQL** (Neon free tier, provisioned through Vercel) |
| AI | **Gemini 2.5 Flash** (`@google/genai`) with deterministic server rules as a fallback |
| Messaging | Durable outbox. WhatsApp Web is intentionally **disabled** in the serverless backend. |
| Deployment | **Vercel** (`toju-api` + `toju-frontend`) |
| Workspace | **npm workspaces** (no pnpm, no Next.js) |

The root is a single npm workspace containing `frontend/` and `backend/`. The active backend is the PostgreSQL implementation in `backend/src/pg/`; the old MongoDB files remain in the repository for reference but are no longer imported by the server entrypoint.

---

## Quick start

### Requirements

- Node.js **20+** (Node 22 recommended)
- npm **10+**
- A PostgreSQL 14+ database. Use Neon, Supabase, Railway, or a local PostgreSQL instance.

### Install

```bash
npm install
```

### Configure

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set `DATABASE_URL` plus a long random `JWT_SECRET`.

### Migrate and seed

```bash
npm run migrate
npm run seed
```

`migrate` creates the PostgreSQL tables and indexes. `seed` replaces the demo dataset.

Demo credentials:

```text
Email:    dr.kunle@lagos.hospital.ng
Password: demo2026
```

The seed creates one hospital, one doctor, four patients, check-ins, alerts, and clinical notes.

### Run

```bash
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:4000**.

`npm run dev` starts the Express API with `ts-node-dev` and the Vite dev server with `/v1` and `/health` proxying to the API.

### Production build

```bash
npm run build
```

This type-checks the frontend, builds the PWA, and compiles the backend. The PWA output is `frontend/dist/`; the API output is `backend/dist/`.

---

## Root scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the API and Vite frontend |
| `npm run dev:api` | Starts only the API |
| `npm run dev:web` | Starts only the Vite frontend |
| `npm run migrate` | Creates/updates the PostgreSQL schema |
| `npm run seed` | Seeds the demo dataset |
| `npm run build` | Builds frontend and backend |
| `npm run typecheck` | Type-checks the frontend and compiles the backend |
| `npm start` | Runs the compiled backend (`backend/dist/index.js`) |
| `npm run preview` | Serves the built PWA with `vite preview` |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `NODE_ENV` | `development` | Use `production` on a server |
| `DATABASE_URL` | unset | PostgreSQL connection string. Required. |
| `FRONTEND_URL` | `http://localhost:5173` | Comma-separated CORS origins |
| `JWT_SECRET` | dev fallback | Set a long random value in production |
| `JWT_EXPIRES_IN` | `7d` | Access-token lifetime |
| `GEMINI_API_KEY` | unset | Without it, triage uses the server rule engine. Signal extraction needs a key. |
| `SYNC_PAGE_SIZE` | `300` | Maximum records per delta-sync page |
| `WHATSAPP_ENABLED` | `false` | Keep `false` on Vercel. The outbox endpoints remain safe stubs. |
| `WHATSAPP_AUTH_PATH` | `.wwebjs_auth` | Only relevant to a separate WhatsApp worker |
| `WHATSAPP_CHROME_PATH` | unset | Only relevant to a separate WhatsApp worker |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | empty | Empty uses the Vite proxy in dev. In production set it to the API origin plus `/v1`. |
| `VITE_API_PROXY` | `http://localhost:4000` | Dev proxy target |

Production example:

```text
VITE_API_URL=https://toju-api.vercel.app/v1
```

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

- Client-generated UUIDs are canonical. PostgreSQL row IDs are never exposed by the API.
- The server records every applied operation in a `sync_operations` ledger keyed by `(doctor_id, operation_id)`.
- Replaying an operation returns `duplicate` and does not duplicate data.
- Server writes increment `server_version`, which drives conflict detection.
- Clinician-local edits win when versions conflict; the conflict is retained for review.

### Offline AI

- Check-ins can be triaged locally with deterministic rules while offline.
- Cloud Gemini jobs are queued in `aiQueue` and retried when online.
- The server always has a rule-based fallback, so a missing `GEMINI_API_KEY` or Gemini outage still produces a RED/YELLOW/GREEN result.
- Every AI result stores provenance: model, prompt version, generation time, source, and confidence.

### Audit

The PWA keeps an append-only local audit log. The API also records server-side audit entries in `audit_logs` for clinical writes, triage, alert resolution, signal approval, and message queueing. Audit failures never block clinical writes.

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

### AI, messaging, and audit

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/ai/triage` | Gemini triage with rule fallback |
| `GET` | `/whatsapp/status` | Outbox counts and disabled state |
| `GET` | `/whatsapp/qr` | Safe stub while WhatsApp is disabled |
| `GET` | `/whatsapp/outbox` | Recent outbound messages |
| `POST` | `/whatsapp/outbox/:id/retry` | Retry a queued/failed message |
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
│   └── vercel.json
├── backend/
│   ├── src/
│   │   ├── app.ts             Express app, CORS, health route
│   │   ├── index.ts           Local listener + Vercel default export
│   │   ├── pg/                Active PostgreSQL backend
│   │   │   ├── controllers/   Auth, patients, sync, AI, notes, audit, WhatsApp stubs
│   │   │   ├── db.ts          pg pool
│   │   │   ├── schema.ts      Tables and indexes
│   │   │   ├── repo.ts        Data-access helpers
│   │   │   ├── dto.ts         API response serializers
│   │   │   ├── migrate.ts     Schema migration script
│   │   │   └── seed.ts        Demo dataset
│   │   ├── services/          Gemini AI, deterministic rules
│   │   ├── middleware/        Auth and error handling
│   │   └── utils/             JWT helpers
│   ├── vercel.json
│   └── package.json
├── scripts/                   Dev bootstrap and seed wrappers
└── package.json               npm workspace root
```

The legacy MongoDB files under `backend/src/models`, `backend/src/controllers`, and related services are retained for reference but are not used by the active entrypoint.

---

## Deployment

### API on Vercel

The API is deployed as the Vercel project **`toju-api`** with root directory **`backend`**.

1. Provision a free Neon PostgreSQL database through the Vercel Marketplace and connect it to `toju-api`.
2. Set these environment variables on `toju-api`:

```text
DATABASE_URL        # provided automatically by the Neon integration
JWT_SECRET          # long random value
FRONTEND_URL        # comma-separated PWA origins
WHATSAPP_ENABLED    # false
```

3. Run the migration and seed against the production database:

```bash
DATABASE_URL="postgresql://..." npm run migrate --workspace backend
DATABASE_URL="postgresql://..." npm run seed --workspace backend
```

4. Deploy:

```bash
vercel --prod --project toju-api
```

The current production API is **https://toju-api.vercel.app**.

### Frontend on Vercel

The PWA projects (`toju-frontend`, `toju-ts`, and `toju-a`) all use root directory `frontend`.

Set `VITE_API_URL` in each project:

```text
VITE_API_URL=https://toju-api.vercel.app/v1
```

Then redeploy the frontend. Vite embeds this value at build time, so changing it requires a new deployment.

### Optional self-hosting

The API is a normal Express app. `npm run build && npm start` runs it on any Node host with `DATABASE_URL` set. The included `backend/Dockerfile` is optional; WhatsApp is disabled by default because the serverless deployment does not run a persistent browser session.

---

## Verification checklist

```bash
npm install
npm run migrate
npm run seed
npm run typecheck
npm run build
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

Deployed verification:

- `https://toju-api.vercel.app/health` returns `ok: true`
- `https://toju-api.vercel.app/v1/auth/login` accepts the demo credentials
- `https://toju-frontend.vercel.app` signs in and loads the four seeded patients

---

## Known limitations

- WhatsApp Web automation is not available on Vercel because it needs a persistent browser session. The outbox is durable and the endpoints are safe stubs; run a separate worker if WhatsApp delivery is required.
- Gemini calls require network access and a valid API key. The deterministic rule engine is the safety net, not a replacement for clinician review.
- Local-first conflicts are preserved and marked; they are not automatically merged field-by-field.
- The demo dataset is intended for evaluation, not real patient data.
