CREATE TABLE IF NOT EXISTS violation_manager_overrides (
 violation_id TEXT PRIMARY KEY REFERENCES violations(id),
 manager_name TEXT NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
