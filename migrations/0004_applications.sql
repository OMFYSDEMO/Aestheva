-- Applications from clinics, salons, wellness centres and independent practitioners who want to join Aestheva.
-- Submitted from /for-practitioners/apply; reviewed by the team at /ops/applications.
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,                 -- AP-XXXXXX, shown to the applicant
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'declined')),
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  area TEXT NOT NULL,                       -- one of the launch areas, or "Other"
  address TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',         -- website or social page
  contact_name TEXT NOT NULL,
  contact_role TEXT NOT NULL,
  phone TEXT NOT NULL,                      -- E.164
  email TEXT NOT NULL,
  categories_json TEXT NOT NULL DEFAULT '[]',
  medical INTEGER NOT NULL DEFAULT 0,       -- offers medical services
  team_size INTEGER NOT NULL DEFAULT 1,
  services_text TEXT NOT NULL,              -- main services with prices, as the applicant wrote them
  establishment_reg TEXT NOT NULL DEFAULT '', -- clinical establishment registration, if any
  practitioner_reg TEXT NOT NULL DEFAULT '',  -- council registration of the lead practitioner, if any
  gstin TEXT NOT NULL DEFAULT '',
  heard_from TEXT NOT NULL DEFAULT '',
  team_notes TEXT NOT NULL DEFAULT '',      -- internal only
  ip_hash TEXT NOT NULL DEFAULT '',         -- for rate limiting; a salted hash, never the address
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX applications_status ON applications(status, created_at);
CREATE INDEX applications_ip ON applications(ip_hash, created_at);
