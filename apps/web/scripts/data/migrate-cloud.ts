import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Run explicitly with DATABASE_URL and NWC_MIGRATION_SOURCE. Never on server startup.
async function main() {
const sourcePath = process.env.NWC_MIGRATION_SOURCE;
if (!sourcePath || !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL and NWC_MIGRATION_SOURCE');
const source = new DatabaseSync(path.resolve(sourcePath), { readOnly: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
const tables = ['users','contractors','projects','project_boundaries','import_batches','violations',
  'audit_events','source_versions','tasks','reference_approvals','system_settings','reference_candidates','schema_repairs'];
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(620260912)");
  await client.query(fs.readFileSync(path.resolve('src/lib/db/migrations/002_cloud_runtime.sql'),'utf8'));
  await client.query(fs.readFileSync(path.resolve('src/lib/db/migrations/003_project_executives.sql'),'utf8'));
  await client.query(fs.readFileSync(path.resolve('src/lib/db/migrations/004_contractor_aliases.sql'),'utf8'));
  await client.query(fs.readFileSync(path.resolve('src/lib/db/migrations/005_manual_responsibility.sql'),'utf8'));
  const occupied = await client.query('SELECT count(*) n FROM users');
  if (Number(occupied.rows[0].n)) throw new Error('Target already contains users; migration stopped without replacing data');
  for (const table of tables) {
    const rows = source.prepare(`SELECT * FROM "${table}"`).all();
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    for (let offset = 0; offset < rows.length; offset += 200) {
      const batch = rows.slice(offset, offset + 200);
      const values = batch.flatMap(row => columns.map(c => row[c]));
      const placeholders = batch.map((_,i) => '(' + columns.map((_,j)=>`$${i*columns.length+j+1}`).join(',') + ')').join(',');
      await client.query(`INSERT INTO "${table}" (${columns.map(c=>`"${c}"`).join(',')}) VALUES ${placeholders}`,values);
    }
    const count = await client.query(`SELECT count(*) n FROM "${table}"`);
    if(Number(count.rows[0].n)!==rows.length) throw new Error('Row count mismatch: '+table);
    console.log(table + ': ' + rows.length + ' verified');
  }
  await client.query('COMMIT');
  console.log('Migration committed. Local data unchanged. Sessions were not transferred.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { source.close(); client.release(); await pool.end(); }

}
main().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed"); process.exitCode=1; });
