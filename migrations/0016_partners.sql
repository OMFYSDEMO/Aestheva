-- Regional Partners: local people who bring businesses onto Aestheva and earn a share of the commission they pay.
-- See "Regional Partner programme" in Drive (06 Operations and partners).
CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                 -- e.g. KOCHI01: on their link and typed on applications
  name TEXT NOT NULL,
  region TEXT NOT NULL,                      -- e.g. Kochi
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  pan TEXT NOT NULL DEFAULT '',              -- for TDS on commission; without it the higher rate applies
  gstin TEXT NOT NULL DEFAULT '',            -- if registered, GST is added to what they are paid
  bank_name TEXT NOT NULL DEFAULT '',        -- account holder's name as the bank has it
  bank_account TEXT NOT NULL DEFAULT '',
  bank_ifsc TEXT NOT NULL DEFAULT '',
  agreement_date TEXT,                       -- YYYY-MM-DD the agreement was signed
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'terminated')),
  ended_on TEXT,                             -- ended: their share continues 6 months after this; terminated: it stops
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Which partner brought a business, fixed by the team when the application is approved (or set by the team later).
ALTER TABLE providers ADD COLUMN partner_id TEXT REFERENCES partners(id);
ALTER TABLE applications ADD COLUMN partner_code TEXT NOT NULL DEFAULT '';

-- One statement per partner per month: their share of the commission received that month, plus activation bonuses.
CREATE TABLE partner_statements (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  month TEXT NOT NULL,                       -- YYYY-MM the commission was received in
  number TEXT NOT NULL UNIQUE,               -- PS/2627/0001, a series per financial year
  share_paise INTEGER NOT NULL,
  bonus_paise INTEGER NOT NULL,
  gross_paise INTEGER NOT NULL,              -- share + bonus
  gst_paise INTEGER NOT NULL,                -- 18% on gross, only for a GST-registered partner
  tds_paise INTEGER NOT NULL,                -- income-tax TDS on commission
  net_paise INTEGER NOT NULL,                -- gross + GST - TDS: what is paid to the partner
  status TEXT NOT NULL CHECK (status IN ('issued', 'paid')),
  paid_on TEXT,
  paid_ref TEXT NOT NULL DEFAULT '',
  emailed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (partner_id, month)
);

-- The figures behind each partner statement, frozen when it is made.
CREATE TABLE partner_lines (
  statement_id TEXT NOT NULL REFERENCES partner_statements(id),
  provider_id TEXT NOT NULL REFERENCES providers(id),
  kind TEXT NOT NULL CHECK (kind IN ('share', 'bonus')),
  source_statement_id TEXT REFERENCES statements(id),   -- the business statement a share comes from
  base_paise INTEGER NOT NULL,               -- commission Aestheva received, excluding GST (0 for a bonus)
  amount_paise INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX partner_lines_statement ON partner_lines (statement_id);
CREATE UNIQUE INDEX partner_lines_once ON partner_lines (kind, provider_id, source_statement_id);   -- a share or bonus is paid once
