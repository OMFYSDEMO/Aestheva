-- Aestheva schema v1. Money is INTEGER paise. Dates are YYYY-MM-DD and times are minutes after midnight,
-- both in India Standard Time (the marketplace's only timezone for now). Timestamps are UTC ISO text.

CREATE TABLE categories (
  id TEXT PRIMARY KEY,                 -- skin, medaes, hair ...
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,           -- URL: /p/<slug>
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Clinic','Salon & studio','Wellness centre','Independent practitioner')),
  city TEXT NOT NULL DEFAULT 'Thiruvananthapuram',
  area TEXT NOT NULL,
  address TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  hours_text TEXT NOT NULL DEFAULT '',
  amenities_json TEXT NOT NULL DEFAULT '[]',
  art INTEGER NOT NULL DEFAULT 0,      -- palette index for the generated artwork until photos exist
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused')),
  razorpay_account_id TEXT,            -- Route linked account (acc_...), set when payouts are enabled
  live_since TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX providers_status ON providers(status, area);

-- What Aestheva checked about a provider, and when. Shown on the profile exactly as stored.
CREATE TABLE verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  label TEXT NOT NULL,
  scope TEXT NOT NULL,
  checked_on TEXT NOT NULL,            -- e.g. 'Aug 2026'
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX verifications_provider ON verifications(provider_id);

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  medical INTEGER NOT NULL DEFAULT 0,  -- registered medical practitioner
  quals_json TEXT NOT NULL DEFAULT '[]',
  registration TEXT NOT NULL DEFAULT '',
  years INTEGER NOT NULL DEFAULT 0,
  langs_json TEXT NOT NULL DEFAULT '[]',
  bio TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX staff_provider ON staff(provider_id);

-- Weekly rota: one row per working day. dow 0 = Sunday.
CREATE TABLE staff_hours (
  staff_id TEXT NOT NULL REFERENCES staff(id),
  dow INTEGER NOT NULL CHECK (dow BETWEEN 0 AND 6),
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  PRIMARY KEY (staff_id, dow),
  CHECK (end_min > start_min)
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  cat TEXT NOT NULL REFERENCES categories(id),
  kind TEXT NOT NULL CHECK (kind IN ('consult','treatment','beauty')),  -- consult/treatment are medical
  dur_min INTEGER NOT NULL CHECK (dur_min > 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  deposit_paise INTEGER NOT NULL DEFAULT 0 CHECK (deposit_paise >= 0),
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  CHECK (deposit_paise <= price_paise)
);
CREATE INDEX services_provider ON services(provider_id, active);

CREATE TABLE service_staff (
  service_id TEXT NOT NULL REFERENCES services(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  PRIMARY KEY (service_id, staff_id)
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,                 -- E.164, e.g. +919876543210. Identity key.
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX clients_phone ON clients(phone);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,            -- AE-7K3QPM, shown to clients
  provider_id TEXT NOT NULL REFERENCES providers(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  dur_min INTEGER NOT NULL,
  service_name TEXT NOT NULL,          -- as booked
  kind TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  deposit_paise INTEGER NOT NULL,
  commission_bp INTEGER NOT NULL,      -- 1000 = 10%, fixed at booking
  source TEXT NOT NULL DEFAULT 'marketplace' CHECK (source IN ('marketplace','direct')),
  status TEXT NOT NULL CHECK (status IN ('held','confirmed','completed','cancelled','no_show','expired')),
  hold_expires_at TEXT,                -- held only: unpaid holds are released after this
  manage_token_hash TEXT NOT NULL,     -- SHA-256 of the secret in the client's manage link
  client_note TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,                   -- client | provider | system
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX bookings_provider_date ON bookings(provider_id, date);
CREATE INDEX bookings_status ON bookings(status, hold_expires_at);
CREATE INDEX bookings_client ON bookings(client_id);

-- Inventory: one row per staff member per 30-minute slot. A held or confirmed booking occupies its slots;
-- the primary key makes a double booking impossible. Rows are deleted when a booking is cancelled or expires.
CREATE TABLE staff_slots (
  staff_id TEXT NOT NULL REFERENCES staff(id),
  date TEXT NOT NULL,
  slot INTEGER NOT NULL,               -- start_min / 30
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  PRIMARY KEY (staff_id, date, slot)
);
CREATE INDEX staff_slots_booking ON staff_slots(booking_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('razorpay','simulated')),
  order_id TEXT NOT NULL UNIQUE,       -- order_... (or sim_... in development)
  payment_id TEXT UNIQUE,              -- pay_...
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','captured','failed','refunded','partially_refunded')),
  method TEXT,                         -- upi, card, netbanking, wallet
  captured_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX payments_booking ON payments(booking_id);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  gateway_refund_id TEXT UNIQUE,       -- rfnd_...
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processed','failed')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Razorpay webhook deliveries already processed (x-razorpay-event-id), so retries are no-ops.
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Complaints and refund reviews, handled by operations.
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,                 -- T-0001
  type TEXT NOT NULL CHECK (type IN ('refund','complaint')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','escalated','resolved')),
  booking_id TEXT REFERENCES bookings(id),
  provider_id TEXT REFERENCES providers(id),
  amount_paise INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  staff_id TEXT REFERENCES staff(id),
  booking_id TEXT REFERENCES bookings(id),
  author TEXT NOT NULL,                -- first name + initial
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  service_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_on TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX reviews_provider ON reviews(provider_id, published);

CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX waitlist_city_email ON waitlist(city, email);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,                 -- client:<id> | system | razorpay | provider:<id> | ops:<email>
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data_json TEXT
);
CREATE INDEX audit_entity ON audit_log(entity, entity_id);

INSERT INTO categories (id, name, sort) VALUES
  ('skin','Skin & facials',1), ('medaes','Medical aesthetics',2), ('hair','Hair & scalp',3), ('ayur','Ayurveda & massage',4),
  ('nails','Nails, lashes & brows',5), ('body','Physio & body',6), ('dental','Smile & dental',7), ('groom','Grooming & makeup',8);
