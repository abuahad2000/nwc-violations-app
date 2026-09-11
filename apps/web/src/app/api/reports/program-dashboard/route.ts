import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import { managerKeySQL, programKeySQL, programNameSQL } from '@/lib/domain/manager';
import {
  summarizeProgramDashboard,
  type ProgramDashboardRow,
  type ProgramCounts,
} from '@/lib/domain/program-dashboard';
export async function GET(req: Request) {
  const auth = await authorize('projects:read');
  if (auth.response) return auth.response;
  try {
    const filters = parseFilters(new URL(req.url).searchParams);
    const { whereSQL, params } = buildViolationFilter(filters, auth.user);
    const result = await db.transaction(async () => {
      const roster = (await db
        .prepare(
          `SELECT DISTINCT ${programKeySQL} program_key,${programNameSQL} program_name,${managerKeySQL} manager_key,trim(COALESCE(p.project_manager_name,'')) manager_name FROM projects p WHERE p.status!='REVIEW'`,
        )
        .all()) as Omit<ProgramDashboardRow, keyof ProgramCounts>[];
      const rows = (await db
        .prepare(
          `SELECT ${programKeySQL} program_key,min(${programNameSQL}) program_name,${managerKeySQL} manager_key,min(trim(COALESCE(p.project_manager_name,''))) manager_name,count(*) total,COALESCE(sum(CASE WHEN v.is_closed=0 THEN 1 ELSE 0 END),0) pending,COALESCE(sum(CASE WHEN v.is_closed=0 AND v.source_status='تحت معالجة المقاول' THEN 1 ELSE 0 END),0) contractor FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c_proj ON c_proj.id=v.project_contractor_id WHERE ${whereSQL} GROUP BY ${programKeySQL},${managerKeySQL}`,
        )
        .all(...params)) as ProgramDashboardRow[];
      const executive = await db
        .prepare('SELECT value FROM system_settings WHERE key=?')
        .get('executive_director_name');
      return {
        ...summarizeProgramDashboard(
          roster.filter(
            (r) =>
              (!filters.program_manager || r.program_key === filters.program_manager) &&
              (!filters.manager || r.manager_key === filters.manager),
          ),
          rows,
        ),
        executive: String(executive?.value || ''),
      };
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: 'تعذر تحميل تقرير مدراء البرامج' }, { status: 400 });
  }
}
