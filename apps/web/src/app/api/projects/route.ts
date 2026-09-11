import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { initializeReference, approveBoundary } from '@/lib/spatial/reference';
import { reclassify } from '@/lib/spatial/reclassify';
import { z } from 'zod';
import { projectServices } from '@/lib/spatial/service-types';
export async function GET() {
  const auth = await authorize('projects:read');
  if (auth.response) return auth.response;
  const projects = await db
    .prepare(
      "SELECT p.*,c.name contractor_name,(SELECT count(*) FROM project_boundaries b WHERE b.project_id=p.id AND b.is_approved=1) approved_boundaries FROM projects p LEFT JOIN contractors c ON c.id=p.contractor_id WHERE p.status!='REVIEW' ORDER BY p.status,p.name",
    )
    .all();
  const initialized = await db
    .prepare(
      process.env.DATABASE_URL
        ? "SELECT table_name name FROM information_schema.tables WHERE table_schema='public' AND table_name='reference_candidates'"
        : "SELECT name FROM sqlite_master WHERE type='table' AND name='reference_candidates'",
    )
    .get();
  const boundaries = initialized
    ? await db
        .prepare(
          'SELECT id,name,source_file,color,proposed_project_id,match_method,candidates_json,approved FROM reference_candidates ORDER BY approved,name',
        )
        .all()
    : [];
  const services = await projectServices(
    projects.map((p) => ({ id: String(p.id), name: String(p.name) })),
  );
  return NextResponse.json({
    projects: projects.map((p) => ({ ...p, ...services.get(String(p.id)) })),
    boundaries,
    can_write: ['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(auth.user.role),
  });
}
export async function POST(req: Request) {
  const auth = await authorize('projects:write', req);
  if (auth.response) return auth.response;
  if (!['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(auth.user.role))
    return NextResponse.json({ message: 'الاعتماد لمدير النظام أو البرنامج' }, { status: 403 });
  try {
    const body = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('sync-reference') }),
        z.object({
          action: z.literal('approve'),
          boundary_id: z.string().max(100),
          project_id: z.string().max(100),
        }),
        z.object({ action: z.literal('classify') }),
      ])
      .parse(await req.json());
    if (body.action === 'sync-reference')
      return NextResponse.json({ status: 'success', ...(await initializeReference(auth.user.id)) });
    if (body.action === 'approve') {
      await approveBoundary(body.boundary_id, body.project_id, auth.user.id);
      return NextResponse.json({ status: 'success' });
    }
    return NextResponse.json({ status: 'success', ...(await reclassify(auth.user.id)) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'تعذر تحديث المرجع' },
      { status: 400 },
    );
  }
}
