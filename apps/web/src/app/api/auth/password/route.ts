import { isSameOrigin } from '@/lib/auth/origin';
import { NextResponse } from 'next/server';
import { getCurrentUser, destroySession } from '@/lib/auth/session';
import { db, hashPassword, verifyPassword } from '@/lib/db/async';
import { z } from 'zod';
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'يلزم الدخول' }, { status: 401 });
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'مصدر غير مسموح' }, { status: 403 });
  try {
    const body = z
      .object({ current: z.string().max(128), password: z.string().min(12).max(128) })
      .parse(await req.json());
    const row = (await db.prepare('SELECT password_hash,salt FROM users WHERE id=?').get(user.id))!;
    if (
      body.current === body.password ||
      !verifyPassword(body.current, String(row.password_hash), String(row.salt))
    )
      return NextResponse.json(
        { message: 'تحقق من كلمة المرور الحالية واختر كلمة جديدة مختلفة' },
        { status: 400 },
      );
    const { hash, salt } = hashPassword(body.password);
    await db
      .prepare('UPDATE users SET password_hash=?,salt=?,must_change_password=0 WHERE id=?')
      .run(hash, salt, user.id);
    await db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    await destroySession();
    return NextResponse.json({ status: 'success' });
  } catch {
    return NextResponse.json(
      { message: 'يلزم كلمة مرور جديدة بطول12 حرفًا على الأقل' },
      { status: 400 },
    );
  }
}
