import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db/async';
import { authorize } from '@/lib/auth/guard';
import { violationManagerNameSQL } from '@/lib/domain/manager';
const querySchema = z.object({
  contractor: z.string().max(100).default(''),
  search: z.string().trim().max(200).default(''),
  scope: z.enum(['UNASSIGNED', 'NO_PROJECT', 'MAINTENANCE', 'ALL']).default('ALL'),
  state: z.enum(['OPEN', 'CLOSED', 'ALL']).default('OPEN'),
  page: z.coerce.number().int().min(1).default(1),
});
export async function GET(req: Request) {
  const auth = await authorize('projects:write');
  if (auth.response) return auth.response;
  try {
    const f = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const clauses = [f.scope === 'UNASSIGNED' ? 'v.current_action_owner_id IS NULL' : '1=1'];
    if (f.scope === 'NO_PROJECT') clauses.push('v.project_id IS NULL');
    if (f.scope === 'MAINTENANCE') clauses.push("v.current_action_owner_id='cont_nwc_operations'");
    const args: string[] = [];
    if (f.state !== 'ALL') clauses.push(f.state === 'OPEN' ? 'v.is_closed=0' : 'v.is_closed=1');
    if (f.contractor) {
      clauses.push('v.reported_contractor_id=?');
      args.push(f.contractor);
    }
    if (f.search) {
      clauses.push('(v.source_reference LIKE ? OR v.district_raw LIKE ?)');
      args.push('%' + f.search + '%', '%' + f.search + '%');
    }
    const where = clauses.join(' AND ');
    const total = await db
      .prepare(`SELECT count(*) n FROM violations v WHERE ${where}`)
      .get(...args);
    const rows = await db
      .prepare(
        `SELECT v.id,v.current_action_owner_id,${violationManagerNameSQL} project_manager_name,(SELECT manager_name FROM violation_manager_overrides WHERE violation_id=v.id) manager_override,(SELECT name FROM contractors WHERE id=v.current_action_owner_id) owner_name,v.source_reference,v.is_closed,v.source_status,v.updated_at,v.project_id,v.latitude,v.longitude,v.district_raw,v.reported_contractor_id,COALESCE(c.name,v.reported_contractor_name) contractor_name,p.name project_name FROM violations v LEFT JOIN contractors c ON c.id=v.reported_contractor_id LEFT JOIN projects p ON p.id=v.project_id WHERE ${where} ORDER BY v.source_reference LIMIT 50 OFFSET ?`,
      )
      .all(...args, (f.page - 1) * 50);
    const projects = await db
      .prepare(
        "SELECT p.id,p.name,p.operational_number,p.contractor_id,p.status,c.name contractor_name,p.project_manager_name,p.program_manager_name,p.executive_director_name FROM projects p JOIN contractors c ON c.id=p.contractor_id WHERE p.status!='REVIEW' ORDER BY c.name,p.name",
      )
      .all();
    const contractors = await db.prepare('SELECT id,name FROM contractors ORDER BY name').all();
    const stats = await db
      .prepare(
        'SELECT count(*) total,sum(CASE WHEN is_closed=0 THEN 1 ELSE 0 END) open,sum(CASE WHEN is_closed=1 THEN 1 ELSE 0 END) closed FROM violations WHERE current_action_owner_id IS NULL',
      )
      .get();
    return NextResponse.json({ rows, total: total?.n, page: f.page, projects, contractors, stats });
  } catch {
    return NextResponse.json({ message: 'تعذر تحميل قائمة الإسناد' }, { status: 400 });
  }
}
const bodySchema = z.object({
  records: z
    .array(z.object({ id: z.string().min(1).max(100), updated_at: z.string().max(50) }))
    .min(1)
    .max(100),
  destination: z.enum(['PROJECT', 'MAINTENANCE']),
  project_id: z.string().max(100).optional(),
  reason: z.string().trim().max(1000).default(''),
});
export async function POST(req: Request) {
  const auth = await authorize('projects:write', req);
  if (auth.response) return auth.response;
  try {
    const body = bodySchema.parse(await req.json());
    if (new Set(body.records.map((r) => r.id)).size !== body.records.length)
      throw Error('تكرار في البلاغات المحددة');
    const result = await db.transaction(async () => {
      const project =
        body.destination === 'PROJECT'
          ? await db
              .prepare("SELECT id,contractor_id,name FROM projects WHERE id=? AND status!='REVIEW'")
              .get(body.project_id || '')
          : null;
      if (body.destination === 'PROJECT' && !project)
        throw Error('اختر مشروعًا معتمدًا من القائمة');
      const owner = project ? String(project.contractor_id) : 'cont_nwc_operations';
      if (!(await db.prepare('SELECT id FROM contractors WHERE id=?').get(owner)))
        throw Error('الجهة المسؤولة غير متاحة');
      const now = new Date().toISOString();
      for (const item of body.records) {
        const old = await db.prepare('SELECT * FROM violations WHERE id=?').get(item.id);
        if (!old || old.updated_at !== item.updated_at)
          throw Error('تغير أحد البلاغات أو أُسند بالفعل. حدّث القائمة قبل المحاولة.');
        await db
          .prepare(
            "UPDATE tasks SET status='SUPERSEDED',version=version+1 WHERE violation_id=? AND status='OPEN'",
          )
          .run(item.id);
        if (!old.is_closed)
          await db
            .prepare(
              "INSERT INTO tasks(id,violation_id,owner_id,reason,status,version,created_by,created_at) VALUES(?,?,?,?,'OPEN',1,?,?)",
            )
            .run(randomUUID(), item.id, owner, body.reason, auth.user.id, now);
        await db
          .prepare(
            'INSERT INTO manual_responsibility(violation_id,project_id,owner_id,reason,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(violation_id) DO UPDATE SET project_id=excluded.project_id,owner_id=excluded.owner_id,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
          )
          .run(item.id, project?.id ?? null, owner, body.reason, auth.user.id, now);
        const sameProject = project && old.project_id === project.id;
        if (!sameProject)
          await db
            .prepare('DELETE FROM violation_manager_overrides WHERE violation_id=?')
            .run(item.id);
        await db
          .prepare(
            'UPDATE violations SET project_id=?,project_contractor_id=?,current_action_owner_id=?,classification=?,classification_reason=?,updated_at=? WHERE id=?',
          )
          .run(
            project?.id ?? null,
            project?.contractor_id ?? null,
            owner,
            sameProject ? old.classification : 'UNDER_REVIEW',
            sameProject
              ? old.classification_reason
              : 'تحديد جهة المتابعة يدويًا؛ لا يمثل اعتمادًا للحدود المكانية. ' + body.reason,
            now,
            item.id,
          );
        await db
          .prepare(
            'INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES(?,?,?,?,?,?,?)',
          )
          .run(
            randomUUID(),
            'RESPONSIBILITY_ASSIGNED',
            'VIOLATION',
            item.id,
            auth.user.id,
            JSON.stringify({
              before: { project_id: old.project_id, owner_id: old.current_action_owner_id },
              after: { project_id: project?.id ?? null, owner_id: owner },
              reason: body.reason,
              closed: old.is_closed,
            }),
            now,
          );
      }
      return { assigned: body.records.length, message: 'تم تحديد الجهة المسؤولة للبلاغات المحددة' };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof z.ZodError
            ? 'حدد البلاغات والجهة وسبب الإسناد'
            : e instanceof Error
              ? e.message
              : 'تعذر الإسناد',
      },
      { status: 400 },
    );
  }
}

const managerSchema = z.object({
  id: z.string().min(1).max(100),
  updated_at: z.string().max(50),
  manager_name: z.string().trim().max(200),
  reason: z.string().trim().max(1000).default(''),
});
export async function PATCH(req: Request) {
  const auth = await authorize('projects:write', req);
  if (auth.response) return auth.response;
  try {
    const input = managerSchema.parse(await req.json());
    if (['الصيانة', 'الصيانه', 'إدارة الصيانة', 'ادارة الصيانة'].includes(input.manager_name))
      return NextResponse.json(
        { message: 'اختر تحويل إلى الصيانة لتحديث الجهة المسؤولة أيضًا' },
        { status: 400 },
      );
    await db.transaction(async () => {
      const old = await db.prepare('SELECT * FROM violations WHERE id=?').get(input.id);
      if (!old || old.updated_at !== input.updated_at) throw Error('STALE');
      if (old.current_action_owner_id === 'cont_nwc_operations' && input.manager_name)
        throw Error('MAINTENANCE');
      const before = await db
        .prepare('SELECT manager_name FROM violation_manager_overrides WHERE violation_id=?')
        .get(input.id);
      const now = new Date().toISOString();
      if (input.manager_name)
        await db
          .prepare(
            'INSERT INTO violation_manager_overrides(violation_id,manager_name,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(violation_id) DO UPDATE SET manager_name=excluded.manager_name,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
          )
          .run(input.id, input.manager_name, auth.user.id, now);
      else
        await db
          .prepare('DELETE FROM violation_manager_overrides WHERE violation_id=?')
          .run(input.id);
      await db.prepare('UPDATE violations SET updated_at=? WHERE id=?').run(now, input.id);
      await db
        .prepare(
          'INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          randomUUID(),
          'VIOLATION_MANAGER_CHANGED',
          'VIOLATION',
          input.id,
          auth.user.id,
          JSON.stringify({
            before: before?.manager_name ?? null,
            after: input.manager_name || null,
            reason: input.reason,
          }),
          now,
        );
    });
    return NextResponse.json({ message: 'تم تحديث مدير هذا البلاغ فقط' });
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    return NextResponse.json(
      {
        message:
          code === 'STALE'
            ? 'تغير البلاغ؛ حدّث القائمة وأعد المحاولة'
            : code === 'MAINTENANCE'
              ? 'البلاغ تابع للصيانة؛ حدد المشروع الصحيح أولًا'
              : 'تعذر التعديل؛ تحقق من الاسم وسبب التغيير',
      },
      { status: code === 'STALE' ? 409 : 400 },
    );
  }
}
