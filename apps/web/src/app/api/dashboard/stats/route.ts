import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authorize } from '@/lib/auth/guard';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import { managerKeySQL, summarizeManagers } from '@/lib/domain/manager';
export async function GET(req: Request) {
  const auth = await authorize('violations:read');
  if (auth.response) return auth.response;
  try {
    const filters = parseFilters(new URL(req.url).searchParams);
    const { whereSQL, params } = buildViolationFilter(filters, auth.user);
    const data = db
      .prepare(
        `SELECT count(*) total,
 COALESCE(sum(v.classification='INSIDE_PROJECT_BOUNDARY'),0) inside_project,
 COALESCE(sum(v.classification='OUTSIDE_PROJECT_BOUNDARY'),0) outside_project,
 COALESCE(sum(v.classification='UNDER_REVIEW'),0) under_review,
 COALESCE(sum(v.is_closed=1),0) closed, COALESCE(sum(v.is_closed=0),0) open,
 COALESCE(sum(v.age_days>180 AND v.is_closed=0),0) age_181_plus,
 COALESCE(sum(v.age_days BETWEEN 0 AND 30 AND v.is_closed=0),0) age_0_30,
 COALESCE(sum(v.age_days BETWEEN 31 AND 90 AND v.is_closed=0),0) age_31_90,
 COALESCE(sum(v.age_days BETWEEN 91 AND 180 AND v.is_closed=0),0) age_91_180,
 COALESCE(sum(EXISTS(SELECT 1 FROM tasks t WHERE t.violation_id=v.id AND t.status='OPEN') AND v.is_closed=0),0) pending_actions
 FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c_proj ON c_proj.id=v.project_contractor_id WHERE ${whereSQL}`,
      )
      .get(...params)!;
    const from = `FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c_proj ON c_proj.id=v.project_contractor_id WHERE ${whereSQL}`;
    const statuses = db
      .prepare(
        `SELECT v.source_status status,count(*) count ${from} GROUP BY v.source_status ORDER BY count(*) DESC`,
      )
      .all(...params);
    const groups = db
      .prepare(
        `SELECT ${managerKeySQL} key,trim(p.project_manager_name) name,v.source_status status,count(*) count,sum(v.is_closed) closed ${from} GROUP BY ${managerKeySQL},v.source_status`,
      )
      .all(...params) as {
      key: string;
      name: string;
      status: string;
      count: number;
      closed: number;
    }[];
    const roster =
      auth.user.role === 'CONTRACTOR_USER'
        ? []
        : (db
            .prepare(
              `SELECT ${managerKeySQL} key,min(trim(p.project_manager_name)) name FROM projects p WHERE p.status!='REVIEW' GROUP BY ${managerKeySQL}`,
            )
            .all() as { key: string; name: string }[]);
    const summary = summarizeManagers(
      filters.manager ? roster.filter((m) => m.key === filters.manager) : roster,
      groups,
    );
    const lastBatch =
      auth.user.role === 'CONTRACTOR_USER'
        ? null
        : db
            .prepare(
              'SELECT filename,created_at,status FROM import_batches ORDER BY created_at DESC LIMIT 1',
            )
            .get();
    return NextResponse.json({
      status: 'success',
      data: {
        ...data,
        statuses,
        managers: summary.managers,
        unassigned_manager: summary.unassigned,
        aging: {
          age_0_30: data.age_0_30,
          age_31_90: data.age_31_90,
          age_91_180: data.age_91_180,
          age_181_plus: data.age_181_plus,
        },
        last_batch: lastBatch || null,
      },
    });
  } catch {
    return NextResponse.json({ message: 'تعذر جلب الإحصاءات؛ تحقق من الفلاتر' }, { status: 400 });
  }
}
