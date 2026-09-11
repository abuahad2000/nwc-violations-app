import { authorize } from '@/lib/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { db, hashPassword } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(12).max(128),
  role: z.enum(['SUPER_ADMIN', 'PROGRAM_MANAGER', 'CONTRACTOR_USER', 'READER']),
  contractor_id: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize('audit:read', req);
    if (auth.response) return auth.response;
    if (auth.user.role !== 'SUPER_ADMIN')
      return NextResponse.json({ message: 'إنشاء الحسابات لمدير النظام فقط' }, { status: 403 });
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { status: 'error', message: 'البيانات المدخلة غير صالحة' },
        { status: 400 },
      );
    }

    const { name, email, password, role, contractor_id } = parsed.data;

    if (
      role === 'CONTRACTOR_USER' &&
      (!contractor_id || !db.prepare('SELECT id FROM contractors WHERE id = ?').get(contractor_id))
    )
      return NextResponse.json({ message: 'يلزم تحديد مقاول مسجل' }, { status: 400 });
    // Check if email exists
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email.toLowerCase().trim());
    if (existing) {
      return NextResponse.json(
        { status: 'error', message: 'البريد الإلكتروني مسجل مسبقاً' },
        { status: 400 },
      );
    }

    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const { hash, salt } = hashPassword(password);

    db.prepare(
      `
      INSERT INTO users (id, name, email, password_hash, salt, role, contractor_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      userId,
      name.trim(),
      email.toLowerCase().trim(),
      hash,
      salt,
      role,
      contractor_id || null,
      new Date().toISOString(),
    );

    db.prepare('UPDATE users SET must_change_password=1 WHERE id=?').run(userId);
    // Audit creation
    db.prepare(
      `
      INSERT INTO audit_events (id, action, entity_type, entity_id, performed_by, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      crypto.randomUUID(),
      'USER_REGISTER_LOCAL',
      'USER',
      userId,
      auth.user.id,
      JSON.stringify({ email, role }),
      new Date().toISOString(),
    );

    return NextResponse.json({
      status: 'success',
      message: 'تم إنشاء المستخدم بنجاح',
      user: { id: userId, name, email, role },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: (error instanceof Error && error.message) || 'حدث خطأ أثناء إنشاء المستخدم',
      },
      { status: 500 },
    );
  }
}
