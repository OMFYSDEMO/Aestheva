-- Self-serve onboarding: a clinic sets up its own listing in the portal, submits it, and the team publishes it.
ALTER TABLE providers ADD COLUMN phone TEXT NOT NULL DEFAULT '';            -- public number for clients, E.164
ALTER TABLE providers ADD COLUMN submitted_at TEXT;                          -- set when the clinic submits for review
ALTER TABLE providers ADD COLUMN review_note TEXT NOT NULL DEFAULT '';       -- the team's note when sending a listing back
ALTER TABLE providers ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE providers ADD COLUMN terms_accepted_by TEXT;                     -- provider_users.id
ALTER TABLE applications ADD COLUMN provider_id TEXT;                        -- the draft venue created when approved

-- Verification documents. Stored privately in R2 under docs/; only the team can open them.
CREATE TABLE provider_documents (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX provider_documents_provider ON provider_documents(provider_id, created_at);
