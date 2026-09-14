import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { z } from 'zod';
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await authorize('projects:read'); if (auth.response) return auth.response;
  try {
    const projectId = z.string().min(1).max(100).parse((await context.params).projectId);
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(100000, Number(query.get('page') || 1))); const limit = Math.max(1, Math.min(100, Number(query.get('limit') || 25)));
    const total = await db.prepare('SELECT COUNT(*) n FROM current_violations WHERE project_id=?').get(projectId);
    const reports = await db.prepare('SELECT * FROM current_violations WHERE project_id=? ORDER BY reported_date DESC,source_reference LIMIT ? OFFSET ?').all(projectId, limit, (page - 1) * limit);
    return NextResponse.json({ reports, page, limit, total: Number(total?.n || 0) });
  } catch { return NextResponse.json({ message: 'تعذر تحميل بلاغات المشروع' }, { status: 400 }); }
}
