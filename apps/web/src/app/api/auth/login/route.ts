import { isSameOrigin } from '@/lib/auth/origin';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db, verifyPassword } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req))
      return NextResponse.json({ message: 'مصدر الطلب غير مسموح' }, { status: 403 });
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { status: 'error', message: 'اسم المستخدم أو كلمة المرور غير صالحة' },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const key = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    const now = Date.now();
    db.prepare('DELETE FROM login_attempts WHERE expires_at < ?').run(now);
    const attempt = db.prepare('SELECT attempts FROM login_attempts WHERE key=?').get(key);
    if (attempt && Number(attempt.attempts) >= 10)
      return NextResponse.json({ message: 'محاولات كثيرة؛ حاول بعد15 دقيقة' }, { status: 429 });
    db.prepare(
      'INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1',
    ).run(key, now + 15 * 60 * 1000);

    const user = db
      .prepare(
        `
      SELECT id, name, email, password_hash, salt, role, contractor_id
      FROM users
      WHERE lower(email) = ? OR lower(username) = ?
    `,
      )
      .get(email.toLowerCase().trim(), email.toLowerCase().trim()) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          salt: string;
          role: string;
          contractor_id: string | null;
        }
      | undefined;

    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'بيانات الدخول غير صحيحة' },
        { status: 401 },
      );
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { status: 'error', message: 'بيانات الدخول غير صحيحة' },
        { status: 401 },
      );
    }

    db.prepare('DELETE FROM login_attempts WHERE key=?').run(key);
    await createSession(user.id);

    // Audit log
    db.prepare(
      `
      INSERT INTO audit_events (id, action, entity_type, entity_id, performed_by, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      crypto.randomUUID(),
      'USER_LOGIN',
      'USER',
      user.id,
      user.id,
      JSON.stringify({ email: user.email, role: user.role }),
      new Date().toISOString(),
    );

    return NextResponse.json({
      status: 'success',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        contractor_id: user.contractor_id,
      },
    });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 },
    );
  }
}
