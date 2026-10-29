-- Venue photographs. A JSON array of {"src": "/venues/<venue>/<name>", "alt": "..."}; each src has
-- -400.webp, -800.webp and -1500.webp variants (and optionally -og.jpg) in public/. Empty: the venue mark is shown.
ALTER TABLE providers ADD COLUMN photos_json TEXT NOT NULL DEFAULT '[]';
