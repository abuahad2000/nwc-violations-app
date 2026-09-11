import path from 'node:path';
import fs from 'node:fs';
import { db, hashPassword } from '../../src/lib/db';
const target = path.resolve(process.env.NWC_DATA_DIR || '');
if (!target.endsWith('nwc-repair-e2e'))
  throw new Error('E2E setup requires isolated nwc-repair-e2e directory');
const now = new Date().toISOString();
for (const [id, role, contractor] of [
  ['e2e_admin', 'SUPER_ADMIN', null],
  ['e2e_reader', 'READER', null],
  ['e2e_a', 'CONTRACTOR_USER', 'a'],
  ['e2e_b', 'CONTRACTOR_USER', 'b'],
] as const) {
  const { hash, salt } = hashPassword('Synthetic-Test-Only-2026');
  db.prepare(
    'INSERT OR REPLACE INTO users (id,name,email,password_hash,salt,role,contractor_id,created_at,must_change_password) VALUES (?,?,?,?,?,?,?,?,0)',
  ).run(id, 'حساب اختبار معزول', id + '@example.test', hash, salt, role, contractor, now);
}
db.prepare('INSERT OR IGNORE INTO contractors VALUES (?,?,1,?)').run('a', 'مقاول تجريبي أ', now);
db.prepare('INSERT OR IGNORE INTO contractors VALUES (?,?,1,?)').run('b', 'مقاول تجريبي ب', now);
for (const [id, classification, owner, closed] of [
  ['test-inside', 'INSIDE_PROJECT_BOUNDARY', 'a', 0],
  ['test-outside', 'OUTSIDE_PROJECT_BOUNDARY', 'b', 0],
  ['test-review', 'UNDER_REVIEW', null, 0],
  ['test-closed', 'UNDER_REVIEW', 'a', 1],
] as const) {
  db.prepare(
    `INSERT OR REPLACE INTO violations (id,source_reference,reported_contractor_name,current_action_owner_id,classification,classification_reason,source_status,reported_date,latitude,longitude,is_closed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    id,
    'بيانات اصطناعية',
    owner,
    classification,
    'اختبار الواجهة',
    closed ? 'تمت المعالجة' : 'تحت معالجة المقاول',
    '2025-01-01',
    24.7,
    46.7,
    closed,
    now,
    now,
  );
}
fs.writeFileSync(path.join(target, 'TEST_DATA_ONLY'), 'No operational data');
db.prepare(
  "INSERT OR REPLACE INTO projects (id,operational_number,name,status,contractor_id,project_manager_name,created_at) VALUES ('e2e-project','e2e-op','مشروع اختبار معزول','ACTIVE','a','م. مدير تجريبي',?)",
).run(now);
db.prepare(
  "UPDATE violations SET project_id='e2e-project',project_contractor_id='a' WHERE id='test-inside'",
).run();
const shortLogin = hashPassword('admin');
db.prepare(
  "INSERT OR REPLACE INTO users (id,name,email,username,password_hash,salt,role,created_at,must_change_password) VALUES ('e2e_alias','مدير اختبار','alias@example.test','qa_admin',?,?,'SUPER_ADMIN',?,0)",
).run(shortLogin.hash, shortLogin.salt, now);
console.log('Synthetic E2E fixture ready');
db.prepare(
  "UPDATE projects SET program_manager_name='م. مدير برنامج تجريبي' WHERE id='e2e-project'",
).run();
