-- Automatic money: how each business is paid, monthly statements with GST invoices, and the frozen figures behind them.

-- How a business is settled:
--   own     Haswel Care's own business (Hasta Wellness): deposits stay with the company; no commission invoice.
--   invoice clients pay the business at the venue; no deposits are taken online; Aestheva invoices commission monthly
--           with a Razorpay payment link.
--   route   20% deposits taken online and split automatically through Razorpay Route (step B).
ALTER TABLE providers ADD COLUMN payout_mode TEXT NOT NULL DEFAULT 'invoice' CHECK (payout_mode IN ('own', 'invoice', 'route'));
ALTER TABLE providers ADD COLUMN gstin TEXT NOT NULL DEFAULT '';          -- the business's GSTIN, if registered
UPDATE providers SET payout_mode = 'own' WHERE id IN ('hasta-wellness', 'aestheva-test');

-- One statement per business per month of appointments, issued automatically after the month closes.
CREATE TABLE statements (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  month TEXT NOT NULL,                       -- YYYY-MM of the appointments it covers
  payout_mode TEXT NOT NULL,
  bookings INTEGER NOT NULL,                 -- lines on the statement
  gross_paise INTEGER NOT NULL,              -- what clients paid in total for completed bookings
  collected_paise INTEGER NOT NULL,          -- what Aestheva holds for the business (deposits kept, plus Aestheva-paid credits)
  commission_paise INTEGER NOT NULL,
  gst_paise INTEGER NOT NULL,                -- GST charged on the commission
  tds_paise INTEGER NOT NULL,
  tcs_paise INTEGER NOT NULL,
  net_paise INTEGER NOT NULL,                -- collected less commission, GST and taxes: positive is owed to the business
  invoice_no TEXT UNIQUE,                    -- GST tax invoice number, only when commission is charged
  status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'paid', 'settled', 'nothing_due')),
  payment_link_id TEXT,
  payment_link_url TEXT,
  issued_at TEXT,
  paid_at TEXT,
  emailed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (provider_id, month)
);
CREATE INDEX statements_status ON statements (status);

-- The figures for each booking on a statement, frozen when the statement is made.
CREATE TABLE statement_lines (
  statement_id TEXT NOT NULL REFERENCES statements(id),
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  outcome TEXT NOT NULL,                     -- completed | no_show | late_cancel
  price_paise INTEGER NOT NULL,
  collected_paise INTEGER NOT NULL,
  commission_bp INTEGER NOT NULL,
  commission_paise INTEGER NOT NULL,
  gst_paise INTEGER NOT NULL,
  tds_paise INTEGER NOT NULL,
  tcs_paise INTEGER NOT NULL,
  net_paise INTEGER NOT NULL
);
CREATE INDEX statement_lines_statement ON statement_lines (statement_id);

-- Invoice numbers run in sequence within each financial year (April to March), as GST requires.
CREATE TABLE invoice_counters (
  fy TEXT PRIMARY KEY,                       -- e.g. 2627 for April 2026 to March 2027
  last_no INTEGER NOT NULL
);
