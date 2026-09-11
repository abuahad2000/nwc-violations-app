import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { findContractor, saveContractorAlias } from '@/lib/domain/contractor-alias';
const fields =
  'id,name,operational_number,contractor_id,project_manager_name,program_manager_name,executive_director_name,subprogram_name';
const version = (row: object) => createHash('sha256').update(JSON.stringify(row)).digest('hex');
const attach = (row: object) => ({ ...row, version: version(row) });
const text = z.string().trim().max(200);
const bodySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('contractor'),
      id: z.string().min(1).max(100),
      version: z.string().length(64),
      name: text.min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('project'),
      id: z.string().min(1).max(100),
      version: z.string().length(64),
      project_manager_name: text,
      program_manager_name: text,
      executive_director_name: text,
      subprogram_name: text,
    })
    .strict(),
]);
export async function GET() {
  const auth = await authorize('contractors:write');
  if (auth.response) return auth.response;
  const contractors = await db.prepare('SELECT id,name FROM contractors ORDER BY name').all();
  const projects = await db
    .prepare(`SELECT ${fields} FROM projects WHERE status!='REVIEW' ORDER BY name`)
    .all();
  return NextResponse.json({
    contractors: contractors.map(attach),
    projects: projects.map(attach),
  });
}
export async function PATCH(req: Request) {
  const auth = await authorize('contractors:write', req);
  if (auth.response) return auth.response;
  try {
    const input = bodySchema.parse(await req.json());
    const result = await db.transaction(async () => {
      const before = await db
        .prepare(
          input.kind === 'contractor'
            ? 'SELECT id,name FROM contractors WHERE id=?'
            : `SELECT ${fields} FROM projects WHERE id=? AND status!='REVIEW'`,
        )
        .get(input.id);
      if (!before) return { status: 404, message: 'السجل غير موجود' };
      if (version(before) !== input.version)
        return {
          status: 409,
          message: 'تغيرت البيانات منذ فتحها. أعد تحميل الصفحة ثم راجع التعديل.',
        };
      if (input.kind === 'contractor') {
        const alias = await findContractor(input.name);
        if (alias && alias.id !== input.id)
          return { status: 409, message: 'هذا الاسم أو أحد أشكاله مسجل لمقاول آخر' };
        const duplicate = await db
          .prepare('SELECT id FROM contractors WHERE name=? AND id!=?')
          .get(input.name, input.id);
        if (duplicate) return { status: 409, message: 'يوجد مقاول آخر بهذا الاسم' };
        await db.prepare('UPDATE contractors SET name=? WHERE id=?').run(input.name, input.id);
        await saveContractorAlias(String(before.name), input.id);
        await saveContractorAlias(input.name, input.id);
      } else {
        await db
          .prepare(
            'UPDATE projects SET project_manager_name=?,program_manager_name=?,executive_director_name=?,subprogram_name=? WHERE id=?',
          )
          .run(
            input.project_manager_name,
            input.program_manager_name,
            input.executive_director_name,
            input.subprogram_name,
            input.id,
          );
      }
      const after = await db
        .prepare(
          input.kind === 'contractor'
            ? 'SELECT id,name FROM contractors WHERE id=?'
            : `SELECT ${fields} FROM projects WHERE id=?`,
        )
        .get(input.id);
      await db
        .prepare(
          'INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          randomUUID(),
          'REFERENCE_DETAILS_UPDATE',
          input.kind.toUpperCase(),
          input.id,
          auth.user.id,
          JSON.stringify({ before, after }),
          new Date().toISOString(),
        );
      return {
        status: 200,
        message: 'تم حفظ البيانات وتحديث التبعية في التقارير',
        record: attach(after!),
      };
    });
    return NextResponse.json(result, { status: result.status });
  } catch (e) {
    return NextResponse.json(
      {
        message:
          e instanceof z.ZodError
            ? 'تحقق من القيم المدخلة'
            : 'تعذر حفظ البيانات. أعد تحميل الصفحة وحاول مجددًا.',
      },
      { status: 400 },
    );
  }
}
