-- One-time links for clinic logins: an invitation to set a password, or a reset after "Forgot password".
-- Only the SHA-256 of the token is stored; a link works once and expires.
CREATE TABLE password_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES provider_users(id),
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX password_links_user ON password_links(user_id, created_at);
