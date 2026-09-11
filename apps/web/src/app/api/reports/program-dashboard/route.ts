import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import { managerKeySQL, programKeySQL, programNameSQL } from '@/lib/domain/manager';
import {
  summarizeProgramDashboard,
  executiveHierarchy,
  type ProgramDashboardRow,
} from '@/lib/domain/program-dashboard';
export async function GET(req: Request) {
  const auth = await authorize('projects:read');
  if (auth.response) return auth.response;
  try {
    const { whereSQL, params } = buildViolationFilter(
      parseFilters(new URL(req.url).searchParams),
      auth.user,
    );
    const rows = (await db
      .prepare(
        `SELECT COALESCE(p.executive_director_name,'') executive,COALESCE(p.subprogram_name,'') subprogram,${programKeySQL} program_key,min(${programNameSQL}) program_name,${managerKeySQL} manager_key,min(trim(COALESCE(p.project_manager_name,''))) manager_name,count(*) total,COALESCE(sum(CASE WHEN v.is_closed=0 THEN 1 ELSE 0 END),0) pending,COALESCE(sum(CASE WHEN v.is_closed=0 AND v.source_status='تحت معالجة المقاول' THEN 1 ELSE 0 END),0) contractor FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c_proj ON c_proj.id=v.project_contractor_id WHERE ${whereSQL} GROUP BY COALESCE(p.executive_director_name,''),COALESCE(p.subprogram_name,''),${programKeySQL},${managerKeySQL}`,
      )
      .all(...params)) as (ProgramDashboardRow & { executive: string; subprogram: string })[];
    return NextResponse.json({
      ...summarizeProgramDashboard([], rows),
      executives: executiveHierarchy(rows),
    });
  } catch {
    return NextResponse.json({ message: 'تعذر تحميل تقرير مدراء البرامج' }, { status: 400 });
  }
}
