-- Regional Partners, phase 2: their own portal, the partner terms they accept there, and applications to become one.

-- Portal logins. Separate from business logins: a partner never sees a business's portal or the team pages.
CREATE TABLE partner_users (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  email TEXT NOT NULL UNIQUE,               -- the login, lower case
  password_hash TEXT NOT NULL,              -- pbkdf2-sha256$...; 'unset$' until set from the invitation link
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE partner_password_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES partner_users(id),
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX partner_password_links_user ON partner_password_links (user_id, created_at);

-- The partner terms, accepted in the portal: when, and which version.
ALTER TABLE partners ADD COLUMN terms_version TEXT NOT NULL DEFAULT '';
ALTER TABLE partners ADD COLUMN terms_accepted_at TEXT;

-- Applications to become a Regional Partner, from bookaestheva.com/become-a-partner.
CREATE TABLE partner_applications (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                 -- RP-7K3QPM
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  background TEXT NOT NULL,
  network TEXT NOT NULL,                    -- who they know, in their words
  businesses_90 INTEGER NOT NULL,           -- how many businesses they think they could bring live in 90 days
  online TEXT NOT NULL DEFAULT '',          -- LinkedIn or Instagram, optional
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'talking', 'accepted', 'declined')),
  team_notes TEXT NOT NULL DEFAULT '',
  partner_id TEXT REFERENCES partners(id),  -- set when the team makes them a partner
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX partner_applications_status ON partner_applications (status, created_at);
