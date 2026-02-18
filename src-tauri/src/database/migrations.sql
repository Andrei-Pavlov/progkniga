-- Migrations for existing databases
-- Run conditionally from Rust (check column existence first)

-- Characters: faction_id, location_id, role
-- ALTER TABLE characters ADD COLUMN faction_id TEXT REFERENCES factions(id);
-- ALTER TABLE characters ADD COLUMN location_id TEXT REFERENCES locations(id);
-- ALTER TABLE characters ADD COLUMN role TEXT;

-- Factions: leader_character_id
-- ALTER TABLE factions ADD COLUMN leader_character_id TEXT REFERENCES characters(id);
