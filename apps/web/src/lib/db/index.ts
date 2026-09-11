import { applyRepairs } from './repairs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let connection: DatabaseSync | null = null;
const db = new Proxy({} as DatabaseSync, {
  get(_target, key) {
    if (!connection) {
      const dataDir = path.resolve(
        /*turbopackIgnore: true*/ process.env.NWC_DATA_DIR || path.join(process.cwd(), 'data'),
      );
      fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
      connection = new DatabaseSync(path.join(dataDir, 'nwc_local.db'));
      connection.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;');
      initDatabase();
      applyRepairs(connection);
    }
    const value = Reflect.get(connection, key);
    return typeof value === 'function' ? value.bind(connection) : value;
  },
});

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL,
      contractor_id TEXT,
      created_at TEXT NOT NULL
    );

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
      latitude REAL,
      longitude REAL,
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
  `);
}

// Password Hashing with PBKDF2 (Secure Salted Hash, no hardcoded plaintext)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(result.hash), Buffer.from(hash));
}

export { db };
