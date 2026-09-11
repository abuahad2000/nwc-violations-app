import { db, hashPassword } from '../../src/lib/db';
import crypto from 'node:crypto';
const username = process.env.NWC_ADMIN_USERNAME || 'admin';
const password = process.env.NWC_ADMIN_PASSWORD;
if (
  !/^[a-zA-Z0-9_-]{3,40}$/.test(username) ||
  !password ||
  password.length < 12 ||
  password.length > 128
)
  throw new Error(
    'Provide NWC_ADMIN_USERNAME and a unique NWC_ADMIN_PASSWORD (12–128 characters).',
  );
db.exec('BEGIN IMMEDIATE');
try {
  if (Number(db.prepare('SELECT count(*) n FROM users').get()!.n) > 0)
    throw new Error('Accounts already exist; bootstrap will not replace them.');
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id,name,email,username,password_hash,salt,role,created_at,must_change_password) VALUES (?,?,?,?,?,?,?,?,0)',
  ).run(
    'usr_admin',
    'مدير النظام',
    username + '@local.invalid',
    username.toLowerCase(),
    hash,
    salt,
    'SUPER_ADMIN',
    now,
  );
  db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)').run(
    crypto.randomUUID(),
    'INITIAL_ADMIN_CREATED',
    'USER',
    'usr_admin',
    'usr_admin',
    JSON.stringify({ username }),
    now,
  );
  db.exec('COMMIT');
  console.log('Initial local administrator created.');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
