#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve(process.env.NWC_DATA_DIR || 'data', 'nwc_local.db');
const db = new DatabaseSync(dbPath);

const args = process.argv.slice(2);
if (args.length < 4) {
  console.log(`
استخدام سكربت إنشاء مستخدم محلي آمن:
node scripts/create-user.mjs <name> <email> <password> <role> [contractor_id]

الأدوار المتاحة (Roles):
- SUPER_ADMIN
- PROGRAM_MANAGER
- CONTRACTOR_USER
- READER

استخدم كلمة مرور أولية فريدة بطول 12–128 حرفًا؛ سيُطلب تغييرها عند الدخول.
  `);
  process.exit(1);
}

const [name, email, password, role, contractorId] = args;

if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
  console.error('الاسم والبريد وكلمة المرور غير صالحة.');
  process.exit(1);
}
if (role === 'CONTRACTOR_USER' && (!contractorId || !db.prepare('SELECT id FROM contractors WHERE id=?').get(contractorId))) {
  console.error('يلزم مقاول مسجل لحساب المقاول.');
  process.exit(1);
}

const validRoles = ['SUPER_ADMIN', 'PROGRAM_MANAGER', 'CONTRACTOR_USER', 'READER'];
if (!validRoles.includes(role)) {
  console.error(`خطأ: الدور "${role}" غير صالح. الأدوار المتاحة هي:`, validRoles.join(', '));
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
const userId = 'usr_' + crypto.randomUUID().slice(0, 8);

try {
  db.prepare(
    `
    INSERT INTO users (id, name, email, password_hash, salt, role, contractor_id, created_at, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `,
  ).run(
    userId,
    name.trim(),
    email.toLowerCase().trim(),
    hash,
    salt,
    role,
    contractorId || null,
    new Date().toISOString(),
  );

  console.log(`✓ تم إنشاء المستخدم بنجاح!`);
  console.log(`- المعرف: ${userId}`);
  console.log(`- الاسم: ${name}`);
  console.log(`- البريد: ${email}`);
  console.log(`- الدور: ${role}`);
  console.log(`- طريقة التشفير: PBKDF2-HMAC-SHA512 (100,000 iterations + 128-bit salt)`);
} catch (err) {
  console.error('فشل حفظ المستخدم:', err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
