import type { DatabaseSync } from 'node:sqlite';

export function applyRepairs(db: DatabaseSync) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_repairs (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_versions (id TEXT PRIMARY KEY, violation_id TEXT NOT NULL, batch_id TEXT, raw_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS import_previews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, filename TEXT NOT NULL, file_hash TEXT NOT NULL, payload TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, violation_id TEXT NOT NULL, owner_id TEXT NOT NULL, reason TEXT NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'OPEN', version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_task ON tasks(violation_id) WHERE status = 'OPEN';
    CREATE TABLE IF NOT EXISTS reference_approvals (project_id TEXT PRIMARY KEY, boundary_id TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
    const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    db.exec(
      'CREATE TABLE IF NOT EXISTS manual_responsibility(violation_id TEXT PRIMARY KEY REFERENCES violations(id),project_id TEXT,owner_id TEXT NOT NULL,reason TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);',
    );
    db.exec(
      'CREATE TABLE IF NOT EXISTS contractor_aliases(alias_name TEXT PRIMARY KEY,normalized_name TEXT NOT NULL,contractor_id TEXT NOT NULL REFERENCES contractors(id)); CREATE INDEX IF NOT EXISTS contractor_aliases_normalized ON contractor_aliases(normalized_name);',
    );
    const projectColumns = db.prepare('PRAGMA table_info(projects)').all() as { name: string }[];
    for (const field of ['executive_director_name', 'subprogram_name']) {
      if (!projectColumns.some((c) => c.name === field))
        db.exec(`ALTER TABLE projects ADD COLUMN ${field} TEXT`);
    }
    if (!columns.some((c) => c.name === 'username')) {
      db.exec(
        'ALTER TABLE users ADD COLUMN username TEXT; CREATE UNIQUE INDEX users_username ON users(username COLLATE NOCASE) WHERE username IS NOT NULL;',
      );
    }
    if (!columns.some((c) => c.name === 'must_change_password')) {
      db.exec(
        "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0; UPDATE users SET must_change_password=1 WHERE id IN ('usr_admin','usr_prog_mgr','usr_cont_civil','usr_reader');",
      );
    }
    if (!db.prepare('SELECT id FROM schema_repairs WHERE id = ?').get('20260911-integrity')) {
      try {
        db.exec(`CREATE TABLE IF NOT EXISTS violations_before_repair_20260911 AS SELECT * FROM violations;
        UPDATE violations SET is_closed = 1 WHERE trim(source_status) IN ('تمت المعالجة', 'معالج', 'مغلق');
        UPDATE violations SET current_action_owner_id = NULL;
        UPDATE violations SET classification = 'UNDER_REVIEW', classification_reason = 'تحتاج مطابقة الرقم التشغيلي واعتماد الحدود وإعادة التصنيف الرسمي', project_id = NULL, project_contractor_id = NULL;
        UPDATE project_boundaries SET is_approved = 0;
      `);
        db.prepare('INSERT INTO schema_repairs VALUES (?, ?)').run(
          '20260911-integrity',
          new Date().toISOString(),
        );
      } catch (error) {
        throw error;
      }
    }
    // Computed on each read. Closed records have no fabricated closure duration.
    db.exec(`CREATE VIEW IF NOT EXISTS current_violations AS SELECT
      id, source_reference, reported_contractor_name, reported_contractor_id,
      project_contractor_id, current_action_owner_id, project_id, latitude, longitude,
      classification, classification_reason, source_status, reported_date, incident_date,
      CASE WHEN is_closed = 1 THEN NULL
        WHEN julianday(COALESCE(reported_date, incident_date)) IS NOT NULL
        AND julianday(COALESCE(reported_date, incident_date)) <= julianday('now','+3 hours','start of day')
        THEN CAST(julianday('now','+3 hours','start of day') - julianday(COALESCE(reported_date, incident_date)) AS INTEGER)
        ELSE NULL END AS age_days,
      description_raw, district_raw, street_raw, city_raw, is_closed, import_batch_id, created_at, updated_at
    FROM violations;`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
