export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  specialty text NOT NULL DEFAULT '',
  hospital_id uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  refresh_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  server_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, client_id)
);

CREATE INDEX IF NOT EXISTS patients_doctor_updated_idx ON patients (doctor_id, updated_at);
CREATE INDEX IF NOT EXISTS patients_doctor_risk_idx ON patients (doctor_id, (data->>'riskScore'));
CREATE INDEX IF NOT EXISTS patients_doctor_client_idx ON patients (doctor_id, client_id);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  server_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, client_id)
);

CREATE INDEX IF NOT EXISTS alerts_doctor_updated_idx ON alerts (doctor_id, updated_at);
CREATE INDEX IF NOT EXISTS alerts_patient_idx ON alerts (patient_id);
CREATE INDEX IF NOT EXISTS alerts_open_idx ON alerts (doctor_id, (COALESCE((data->>'resolved')::boolean, false)));

CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  server_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, client_id)
);

CREATE INDEX IF NOT EXISTS check_ins_doctor_updated_idx ON check_ins (doctor_id, updated_at);
CREATE INDEX IF NOT EXISTS check_ins_patient_idx ON check_ins (patient_id, (data->>'timestamp'));

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  server_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, client_id)
);

CREATE INDEX IF NOT EXISTS notes_doctor_updated_idx ON notes (doctor_id, updated_at);
CREATE INDEX IF NOT EXISTS notes_patient_idx ON notes (patient_id, (data->>'createdAt'));

CREATE TABLE IF NOT EXISTS sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id text NOT NULL,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  device_id text,
  entity_type text,
  entity_id text,
  op text,
  status text,
  result jsonb,
  error text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, operation_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  summary text NOT NULL,
  prompt_version text,
  model text,
  device_id text,
  detail jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_doctor_time_idx ON audit_logs (doctor_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  priority integer NOT NULL DEFAULT 35,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_doctor_time_idx ON outbound_messages (doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outbound_status_idx ON outbound_messages (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  body text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false,
  raw jsonb
);
`
