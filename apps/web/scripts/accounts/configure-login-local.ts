import { db, hashPassword } from '../../src/lib/db';
import crypto from 'node:crypto';
const username = process.env.NWC_ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.NWC_ADMIN_PASSWORD;
if (!username || !password)
  throw new Error('Set NWC_ADMIN_USERNAME and NWC_ADMIN_PASSWORD for this local account change.');
const user = db.prepare("SELECT id FROM users WHERE id='usr_admin' AND role='SUPER_ADMIN'").get();
if (!user) throw new Error('Existing local administrator not found; no account was changed.');
const conflict = db
  .prepare('SELECT id FROM users WHERE id!=? AND (lower(username)=? OR lower(email)=?)')
  .get(user.id, username, username);
if (conflict) throw new Error('Username belongs to another account.');
const { hash, salt } = hashPassword(password);
db.exec('BEGIN IMMEDIATE');
try {
  db.prepare(
    'UPDATE users SET username=?,password_hash=?,salt=?,must_change_password=0 WHERE id=?',
  ).run(username, hash, salt, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
  db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)').run(
    crypto.randomUUID(),
    'USER_LOGIN_CONFIGURED',
    'USER',
    user.id,
    user.id,
    JSON.stringify({ username, reason: 'Explicit local user request' }),
    new Date().toISOString(),
  );
  db.exec('COMMIT');
  console.log('Local administrator login updated; previous sessions revoked.');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
