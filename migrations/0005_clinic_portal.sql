-- Clinic portal (/clinic): logins for venue staff, and time a practitioner is unavailable.

-- Logins are issued by the Aestheva team at /ops/clinics with a generated password shown once.
CREATE TABLE provider_users (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,               -- the login, lower case
  password_hash TEXT NOT NULL,              -- pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX provider_users_provider ON provider_users(provider_id);

-- Leave, breaks and other unavailable time. Online availability skips these; the clinic can remove them.
CREATE TABLE staff_blocks (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_min > start_min)
);
CREATE INDEX staff_blocks_day ON staff_blocks(staff_id, date);
