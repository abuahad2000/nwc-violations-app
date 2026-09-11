import { violationScope } from '@/lib/domain/filters';
import { authorize } from '@/lib/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/async';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorize('violations:read');
    if (auth.response) return auth.response;
    const { id } = await params;
    const scope = violationScope(auth.user);

    const row = await db
      .prepare(
        `
      SELECT
        v.*,
        v.reported_contractor_name as source_reported_contractor_name,
        COALESCE(c_rep.name,v.reported_contractor_name) as reported_contractor_name,
        p.name as project_name,
        p.operational_number as project_op_number,
        p.scope_description as project_scope,
        p.program_manager_name,
        p.project_manager_name,
        c_proj.name as project_contractor_name,
        c_rep.name as canonical_reported_contractor_name
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN contractors c_proj ON v.project_contractor_id = c_proj.id
      LEFT JOIN contractors c_rep ON v.reported_contractor_id = c_rep.id
      WHERE (v.id = ? OR v.source_reference = ?) AND ${scope.sql}
    `,
      )
      .get(id, id, ...scope.params);

    if (!row) {
      return NextResponse.json({ status: 'error', message: 'البلاغ غير موجود' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'success',
      data: row,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: (err instanceof Error && err.message) || 'فشل جلب تفاصيل البلاغ',
      },
      { status: 500 },
    );
  }
}
