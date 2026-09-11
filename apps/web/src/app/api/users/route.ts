import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import {
  managedUsers,
  managedUsersSQL,
  removalReason,
  type ManagedUser,
} from '@/lib/auth/user-removal';
import crypto from 'node:crypto';
import { z } from 'zod';
export async function GET() {
  const auth = await authorize('audit:read');
  if (auth.response) return auth.response;
  const users = await managedUsers();
  const admins = users.filter((u) => u.role === 'SUPER_ADMIN').length;
  return NextResponse.json({
    data: users.map((u) => ({ ...u, delete_reason: removalReason(u, auth.user.id, admins) })),
  });
}

export async function DELETE(req: Request) {
  const auth = await authorize('audit:read', req);
  if (auth.response) return auth.response;
  if (auth.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ message: 'الحذف لمدير النظام فقط' }, { status: 403 });
  try {
    const { id } = z.object({ id: z.string().min(1).max(100) }).parse(await req.json());
    const result = await db.transaction(async () => {
      if (process.env.DATABASE_URL)
        await db.prepare('SELECT id FROM users ORDER BY id FOR UPDATE').all();
      const user = (await db
        .prepare(managedUsersSQL + ' WHERE u.id=?')
        .get(new Date().toISOString(), id)) as ManagedUser | undefined;
      if (!user) return { message: 'الحساب غير موجود', status: 404 };
      const admins = await db
        .prepare("SELECT count(*) n FROM users WHERE role='SUPER_ADMIN'")
        .get();
      const reason = removalReason(user, auth.user.id, Number(admins?.n || 0));
      if (reason) return { message: reason, status: 409 };
      await db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
      await db.prepare('DELETE FROM import_previews WHERE user_id=?').run(id);
      await db.prepare('DELETE FROM users WHERE id=?').run(id);
      await db
        .prepare(
          'INSERT INTO audit_events (id,action,entity_type,entity_id,performed_by,details,created_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          crypto.randomUUID(),
          'USER_DELETE_UNUSED',
          'USER',
          id,
          auth.user.id,
          JSON.stringify({ name: user.name, email: user.email, role: user.role }),
          new Date().toISOString(),
        );
      return { message: 'تم حذف الحساب غير المستخدم وتسجيل العملية', status: 200 };
    });
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof z.ZodError
            ? 'معرّف الحساب غير صالح'
            : 'تعذر حذف الحساب؛ حدّث القائمة وحاول مجددًا',
      },
      { status: e instanceof z.ZodError ? 400 : 409 },
    );
  }
}
