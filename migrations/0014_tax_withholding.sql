-- Tax Aestheva withholds as a marketplace, as confirmed by Haswel Care's chartered accountant on 2026-10-31.
-- Income-tax TDS 0.1% on the gross value of each completed booking (before commission, including what the client pays
-- at the venue). GST TCS 0.5% on the value excluding GST, for registered businesses' taxable services, where Aestheva
-- collects the client's money.
ALTER TABLE providers ADD COLUMN pan TEXT NOT NULL DEFAULT '';               -- the business's PAN, for TDS credit
ALTER TABLE providers ADD COLUMN gst_rate_bp INTEGER NOT NULL DEFAULT 0;     -- GST the business charges on its services: 0 (not registered or exempt), 500, 1800
ALTER TABLE providers ADD COLUMN tds_exempt INTEGER NOT NULL DEFAULT 0;      -- set by the team when an income-tax exemption applies
ALTER TABLE statement_lines ADD COLUMN taxable_paise INTEGER NOT NULL DEFAULT 0;   -- the value excluding GST, the TCS base
