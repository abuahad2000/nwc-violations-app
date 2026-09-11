import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'nwc_local.db');
const db = new DatabaseSync(dbPath);

console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
console.log('Users:', db.prepare('SELECT id, name, email, role, contractor_id FROM users').all());
try {
  console.log('Violations count:', db.prepare('SELECT count(*) as count FROM violations').get());
  console.log('Projects count:', db.prepare('SELECT count(*) as count FROM projects').get());
  console.log('Contractors count:', db.prepare('SELECT count(*) as count FROM contractors').all());
  console.log('Import batches:', db.prepare('SELECT * FROM import_batches').all());
} catch (err) {
  console.error('Query error:', err.message);
}
