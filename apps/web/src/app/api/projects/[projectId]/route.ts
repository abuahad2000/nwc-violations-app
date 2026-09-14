import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { z } from 'zod';
const paramsSchema = z.object({ projectId: z.string().min(1).max(100) });
export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await authorize('projects:read'); if (auth.response) return auth.response;
  try {
    const { projectId } = paramsSchema.parse(await context.params);
    const project = await db.prepare(`SELECT p.*, c.name contractor_name, (SELECT COUNT(*) FROM project_boundaries b WHERE b.project_id=p.id AND b.is_approved=1) approved_boundaries FROM projects p LEFT JOIN contractors c ON c.id=p.contractor_id WHERE p.id=? AND p.status!='REVIEW'`).get(projectId);
    if (!project) return NextResponse.json({ message: 'المشروع غير موجود' }, { status: 404 });
    const reports = await db.prepare(`SELECT v.id,v.source_reference,v.source_status,v.is_closed,v.latitude,v.longitude,v.district_raw,v.street_raw,v.reported_contractor_name,v.project_id,v.reported_date,v.description_raw FROM current_violations v WHERE v.project_id=? ORDER BY v.reported_date DESC,v.source_reference LIMIT 1000`).all(projectId);
    const boundaries = await db.prepare('SELECT id,geometry_json,is_approved,version FROM project_boundaries WHERE project_id=? AND is_approved=1 ORDER BY version DESC').all(projectId);
    const stats = await db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN is_closed=0 THEN 1 ELSE 0 END) open, SUM(CASE WHEN is_closed=1 THEN 1 ELSE 0 END) closed FROM current_violations WHERE project_id=?`).get(projectId);
    return NextResponse.json({ project, reports, boundaries, stats });
  } catch { return NextResponse.json({ message: 'تعذر تحميل تفاصيل المشروع' }, { status: 400 }); }
}
