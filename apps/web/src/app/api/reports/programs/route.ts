import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { programKeySQL, programNameSQL } from '@/lib/domain/manager';
import {
  buildProgramReports,
  type ProgramProject,
  type ProgramViolation,
} from '@/lib/domain/program-report';
export async function GET() {
  const auth = await authorize('projects:read');
  if (auth.response) return auth.response;
  try {
    const result = await db.transaction(async () => {
      const projects = (await db
        .prepare(
          `SELECT p.id,p.name,p.operational_number,p.status,p.project_manager_name,${programNameSQL} program_manager_name,${programKeySQL} program_key,c.name contractor_name FROM projects p LEFT JOIN contractors c ON c.id=p.contractor_id WHERE p.status!='REVIEW' ORDER BY p.name`,
        )
        .all()) as ProgramProject[];
      const rows = (await db
        .prepare(
          `SELECT v.id,v.source_reference,v.project_id,v.source_status,v.is_closed,v.age_days,v.district_raw,v.reported_date,p.name project_name,p.project_manager_name,${programNameSQL} program_manager_name,${programKeySQL} program_key,c.name contractor_name FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c ON c.id=p.contractor_id ORDER BY v.id LIMIT 10001`,
        )
        .all()) as ProgramViolation[];
      if (rows.length > 10000) throw new Error('REPORT_LIMIT');
      return buildProgramReports(projects, rows);
    });
    return NextResponse.json({ ...result, generated_at: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { message: 'تعذر تحميل تقرير البرامج؛ الحد الأقصى للتقرير 10000 بلاغ' },
      { status: 400 },
    );
  }
}
