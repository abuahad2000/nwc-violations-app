CREATE TABLE IF NOT EXISTS contractor_aliases (
 alias_name TEXT PRIMARY KEY,
 normalized_name TEXT NOT NULL,
 contractor_id TEXT NOT NULL REFERENCES contractors(id)
);
CREATE INDEX IF NOT EXISTS contractor_aliases_normalized ON contractor_aliases(normalized_name);
