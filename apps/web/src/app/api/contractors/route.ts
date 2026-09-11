import { authorize } from '@/lib/auth/guard';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/async';

export async function GET() {
  try {
    const auth = await authorize('contractors:read');
    if (auth.response) return auth.response;
    // List all contractors with dynamic counts for the 3 separated facets:
    // a) reported in source
    // b) inside their project boundaries
    // c) assigned action items
    const rows = await db
      .prepare(
        `
      SELECT
        c.id,
        c.name,
        c.is_approved,
        (SELECT COUNT(*) FROM current_violations WHERE reported_contractor_id = c.id OR reported_contractor_name = c.name) as reported_violations_count,
        (SELECT COUNT(*) FROM current_violations WHERE project_contractor_id = c.id) as boundary_violations_count,
        (SELECT COUNT(*) FROM current_violations WHERE current_action_owner_id = c.id AND is_closed = 0) as assigned_actions_count,
        (SELECT COUNT(*) FROM projects WHERE contractor_id = c.id) as projects_count
      FROM contractors c
      WHERE (
        (SELECT COUNT(*) FROM current_violations WHERE reported_contractor_id = c.id OR reported_contractor_name = c.name) > 0
        OR (SELECT COUNT(*) FROM current_violations WHERE project_contractor_id = c.id) > 0
        OR (SELECT COUNT(*) FROM projects WHERE contractor_id = c.id) > 0
      )
      ORDER BY assigned_actions_count DESC, boundary_violations_count DESC, reported_violations_count DESC
    `,
      )
      .all();

    return NextResponse.json({
      status: 'success',
      data: rows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: (err instanceof Error && err.message) || 'فشل جلب قائمة المقاولين',
      },
      { status: 500 },
    );
  }
}
