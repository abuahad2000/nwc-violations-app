-- PostgreSQL schema for the deployed application; preserves current text IDs.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL,
    contractor_id TEXT,
    created_at TEXT NOT NULL
  , must_change_password INTEGER NOT NULL DEFAULT 0, username TEXT);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

CREATE TABLE IF NOT EXISTS contractors (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    operational_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    scope_description TEXT,
    status TEXT NOT NULL,
    contractor_id TEXT NOT NULL,
    program_manager_name TEXT,
    project_manager_name TEXT,
    created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS project_boundaries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    geometry_json TEXT NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    status TEXT NOT NULL,
    imported_by TEXT,
    created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS violations (
    id TEXT PRIMARY KEY,
    source_reference TEXT UNIQUE NOT NULL,
    reported_contractor_name TEXT,
    reported_contractor_id TEXT,
    project_contractor_id TEXT,
    current_action_owner_id TEXT,
    project_id TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    classification TEXT NOT NULL,
    classification_reason TEXT,
    source_status TEXT NOT NULL,
    reported_date TEXT,
    incident_date TEXT,
    age_days INTEGER,
    description_raw TEXT,
    district_raw TEXT,
    street_raw TEXT,
    city_raw TEXT,
    is_closed INTEGER NOT NULL DEFAULT 0,
    import_batch_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS source_versions (id TEXT PRIMARY KEY, violation_id TEXT NOT NULL, batch_id TEXT, raw_json TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS import_previews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, filename TEXT NOT NULL, file_hash TEXT NOT NULL, payload TEXT NOT NULL, expires_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, violation_id TEXT NOT NULL, owner_id TEXT NOT NULL, reason TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'OPEN', version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS reference_approvals (project_id TEXT PRIMARY KEY, boundary_id TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS reference_candidates (id TEXT PRIMARY KEY, name TEXT NOT NULL, source_file TEXT NOT NULL, color TEXT, geometry_json TEXT NOT NULL, proposed_project_id TEXT, match_method TEXT, candidates_json TEXT, approved INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS schema_repairs (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(lower(username)) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_task ON tasks(violation_id) WHERE status='OPEN';

CREATE INDEX IF NOT EXISTS violations_owner ON violations(current_action_owner_id);

CREATE INDEX IF NOT EXISTS violations_project ON violations(project_id);

CREATE INDEX IF NOT EXISTS tasks_violation ON tasks(violation_id);

CREATE OR REPLACE FUNCTION nwc_source_date(value text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
 RETURN substring(value from 1 for 10)::date;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END; $$;

CREATE OR REPLACE VIEW current_violations AS SELECT
      id, source_reference, reported_contractor_name, reported_contractor_id,
      project_contractor_id, current_action_owner_id, project_id, latitude, longitude,
      classification, classification_reason, source_status, reported_date, incident_date,
      CASE WHEN is_closed=1 THEN NULL
      WHEN nwc_source_date(COALESCE(reported_date,incident_date)) <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date
      THEN (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date - nwc_source_date(COALESCE(reported_date,incident_date))
      ELSE NULL END AS age_days,
      description_raw, district_raw, street_raw, city_raw, is_closed, import_batch_id, created_at, updated_at
    FROM violations;