-- Shared equipment (a laser machine, a treatment room) that limits bookings across practitioners.
-- A booking for a service that needs a resource also occupies that resource's 30-minute slots; the primary key on
-- resource_slots stops two bookings from using the same machine at the same time, whichever practitioner takes them.

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX resources_provider ON resources(provider_id);

CREATE TABLE service_resources (
  service_id TEXT NOT NULL REFERENCES services(id),
  resource_id TEXT NOT NULL REFERENCES resources(id),
  PRIMARY KEY (service_id, resource_id)
);

CREATE TABLE resource_slots (
  resource_id TEXT NOT NULL REFERENCES resources(id),
  date TEXT NOT NULL,
  slot INTEGER NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  PRIMARY KEY (resource_id, date, slot)
);
CREATE INDEX resource_slots_booking ON resource_slots(booking_id);
