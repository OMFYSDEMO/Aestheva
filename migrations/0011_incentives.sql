-- Phase 1 incentives.
-- Founding partners: the first 50 businesses to go live get a number, and with it 0% commission for 3 months, then 7.5%
-- until their first anniversary on Aestheva.
ALTER TABLE providers ADD COLUMN founding_no INTEGER;
-- "Your link": bookings made after arriving through the business's own link (/b/<slug>) carry no commission.
ALTER TABLE bookings ADD COLUMN channel TEXT NOT NULL DEFAULT '';
-- Welcome offer: an amount Aestheva pays towards the deposit of a client's first booking (the client pays the deposit less this).
ALTER TABLE bookings ADD COLUMN credit_paise INTEGER NOT NULL DEFAULT 0;
