import { violationScope } from '@/lib/domain/filters';
import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { z } from 'zod';
import crypto from 'node:crypto';
export async function POST(req: Request) {
  const auth = await authorize('violations:write', req);
  if (auth.response) return auth.response;
  if (!['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(auth.user.role))
    return NextResponse.json({ message: 'الإسناد لمدير النظام أو البرنامج' }, { status: 403 });
  try {
    const body = z
      .object({
        violation_id: z.string().max(100),
        owner_id: z.string().max(100),
        reason: z.string().min(5).max(1000),
        due_date: z.string().date().nullable(),
        expected_owner: z.string().nullable(),
        expected_updated_at: z.string(),
      })
      .parse(await req.json());
    if (!db.prepare('SELECT id FROM contractors WHERE id=?').get(body.owner_id))
      return NextResponse.json({ message: 'الجهة غير موجودة' }, { status: 400 });
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db
        .prepare('SELECT current_action_owner_id,is_closed,updated_at FROM violations WHERE id=?')
        .get(body.violation_id);
      if (!row || row.is_closed) throw new Error('السجل غير موجود أو مغلق');
      if (
        row.current_action_owner_id !== body.expected_owner ||
        row.updated_at !== body.expected_updated_at
      )
        throw new Error('تغير الإسناد؛ حدّث التفاصيل أولًا');
      const now = new Date().toISOString();
      db.prepare(
        "UPDATE tasks SET status='SUPERSEDED',version=version+1 WHERE violation_id=? AND status='OPEN'",
      ).run(body.violation_id);
      db.prepare(
        "INSERT INTO tasks (id,violation_id,owner_id,reason,due_date,status,created_by,created_at) VALUES (?,?,?,?,?,'OPEN',?,?)",
      ).run(
        crypto.randomUUID(),
        body.violation_id,
        body.owner_id,
        body.reason,
        body.due_date,
        auth.user.id,
        now,
      );
      db.prepare('UPDATE violations SET current_action_owner_id=?,updated_at=? WHERE id=?').run(
        body.owner_id,
        now,
        body.violation_id,
      );
      db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)').run(
        crypto.randomUUID(),
        'TASK_ASSIGNED',
        'VIOLATION',
        body.violation_id,
        auth.user.id,
        JSON.stringify(body),
        now,
      );
      db.exec('COMMIT');
      return NextResponse.json({ status: 'success' });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'فشل الإسناد' },
      { status: 400 },
    );
  }
}

export async function GET(req: Request) {
  const auth = await authorize('violations:read');
  if (auth.response) return auth.response;
  const id = new URL(req.url).searchParams.get('violation_id') || '';
  const scope = violationScope(auth.user);
  if (
    !db
      .prepare(`SELECT id FROM violations v WHERE v.id=? AND ${scope.sql}`)
      .get(id, ...scope.params)
  )
    return NextResponse.json({ message: 'البلاغ غير متاح' }, { status: 404 });
  const canWrite = ['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(auth.user.role);
  return NextResponse.json({
    tasks: db
      .prepare(
        'SELECT t.*,c.name owner_name FROM tasks t LEFT JOIN contractors c ON c.id=t.owner_id WHERE violation_id=? ORDER BY created_at DESC',
      )
      .all(id),
    can_write: canWrite,
    contractors: canWrite ? db.prepare('SELECT id,name FROM contractors ORDER BY name').all() : [],
  });
}
