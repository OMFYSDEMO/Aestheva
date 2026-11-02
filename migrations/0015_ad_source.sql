-- Where an application came from: the Google Ads click ID and utm_ tags carried from the landing page, as JSON ('' when none).
-- Click IDs are removed after 90 days (pruneClickIds); campaign names and the landing page stay.
ALTER TABLE applications ADD COLUMN ad_source TEXT NOT NULL DEFAULT '';
