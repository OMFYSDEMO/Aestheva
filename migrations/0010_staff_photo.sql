-- A photo for each person on a listing: the path prefix of square WebP files, <photo>-160.webp and <photo>-320.webp.
ALTER TABLE staff ADD COLUMN photo TEXT NOT NULL DEFAULT '';
