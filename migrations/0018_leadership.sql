-- The leadership record: a private, append-only timeline of the communications, documents and agreements between
-- Aestheva's leaders (the Managing Director and the CEO), kept in order from day 1 so that what was agreed is clear.

-- Leaders: individual logins, separate from the shared team key, the business portal and the partner portal.
CREATE TABLE leaders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                       -- "Managing Director", "Chief Executive Officer"
  email TEXT NOT NULL UNIQUE,               -- the login, lower case
  password_hash TEXT NOT NULL,              -- pbkdf2-sha256$...; 'unset$' until set from the invitation link
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE leader_links (
  id TEXT PRIMARY KEY,
  leader_id TEXT NOT NULL REFERENCES leaders(id),
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX leader_links_leader ON leader_links (leader_id, created_at);

-- The record. Append-only: corrections, new versions, confirmations and disputes are new entries that refer to an
-- earlier one. Each entry's hash covers its content, its files' hashes and the previous entry's hash, so any change
-- to an earlier entry breaks the chain.
CREATE TABLE leader_entries (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,              -- 1, 2, 3… in the order recorded
  recorded_at TEXT NOT NULL,                -- when it was added to the record (UTC)
  occurred_on TEXT NOT NULL,                -- the date it happened (YYYY-MM-DD), which can be earlier
  kind TEXT NOT NULL CHECK (kind IN ('opened', 'note', 'message', 'meeting', 'document', 'agreement', 'revision', 'correction', 'confirm', 'dispute', 'access')),
  channel TEXT NOT NULL DEFAULT '',         -- email, WhatsApp, phone, video call, in person, document
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author_id TEXT,                           -- the leader who recorded it; NULL for entries the system adds
  author_name TEXT NOT NULL,                -- as it was when recorded
  refers_to INTEGER,                        -- seq of the entry this confirms, disputes, corrects or revises
  files_json TEXT NOT NULL DEFAULT '[]',    -- [{name, type, size, sha256, key}]
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE
);
CREATE INDEX leader_entries_refers ON leader_entries (refers_to);
CREATE TRIGGER leader_entries_no_update BEFORE UPDATE ON leader_entries BEGIN SELECT RAISE(ABORT, 'The leadership record is append-only'); END;
CREATE TRIGGER leader_entries_no_delete BEFORE DELETE ON leader_entries BEGIN SELECT RAISE(ABORT, 'The leadership record is append-only'); END;
