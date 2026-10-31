-- Quiet-hour offers: a business discounts chosen non-medical services at times it is usually quiet.
-- The business pays for the discount; a booking stores the offer it used, so editing or ending an offer never changes it.
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  amount_type TEXT NOT NULL CHECK (amount_type IN ('fixed', 'percent')),
  amount INTEGER NOT NULL,                   -- paise when fixed, whole percent when percent
  services_json TEXT NOT NULL DEFAULT '[]',  -- the service ids it covers
  days TEXT NOT NULL,                        -- days of the week it runs, e.g. "2,3,4" (0 = Sunday)
  start_min INTEGER NOT NULL,                -- appointments starting from this time ...
  end_min INTEGER NOT NULL,                  -- ... and before this time (IST minutes after midnight)
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  monthly_cap INTEGER NOT NULL,              -- discounted bookings per calendar month of appointments
  status TEXT NOT NULL DEFAULT 'on' CHECK (status IN ('on', 'paused', 'ended')),
  paused_by TEXT,                            -- 'provider' or 'ops' (a pause by the Aestheva team can only be lifted by the team)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX offers_provider ON offers (provider_id, status);

-- bookings.price_paise is what the client pays in total; offer_paise is the discount taken off the full price.
ALTER TABLE bookings ADD COLUMN offer_id TEXT;
ALTER TABLE bookings ADD COLUMN offer_paise INTEGER NOT NULL DEFAULT 0;
CREATE INDEX bookings_offer ON bookings (offer_id) WHERE offer_id IS NOT NULL;
