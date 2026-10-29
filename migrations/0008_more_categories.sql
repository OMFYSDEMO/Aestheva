-- Room for everyone: tattoo and piercing artists get their own category, and makeup leads its category's name.
INSERT INTO categories (id, name, sort) VALUES ('tattoo', 'Tattoo & piercing', 9);
UPDATE categories SET name = 'Makeup & grooming' WHERE id = 'groom';
