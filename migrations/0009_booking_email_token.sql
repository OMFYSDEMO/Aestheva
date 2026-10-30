-- A second private link to a booking, issued when its confirmation email is sent (the booking-page link is only known
-- at the moment of booking, and a deposit booking is confirmed later, when the payment arrives).
ALTER TABLE bookings ADD COLUMN email_token_hash TEXT;
