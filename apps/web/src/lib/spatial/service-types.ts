import { db } from '@/lib/db/async';
import { classifyProjectService } from '@/lib/domain/service-type';

export async function projectServices(projects: { id: string; name: string }[]) {
  const exists = await db
    .prepare(
      process.env.DATABASE_URL
        ? "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='reference_candidates'"
        : "SELECT name FROM sqlite_master WHERE type='table' AND name='reference_candidates'",
    )
    .get();
  const references = exists
    ? await db
        .prepare(
          `SELECT b.id,b.project_id,r.color,r.source_file
    FROM project_boundaries b JOIN reference_candidates r ON r.id=b.id
    WHERE b.is_approved=1`,
        )
        .all()
    : [];
  return new Map(
    projects.map((p) => [
      p.id,
      classifyProjectService(
        p.name,
        references
          .filter((r) => r.project_id === p.id)
          .map((r) => ({ color: String(r.color || ''), source_file: String(r.source_file || '') })),
      ),
    ]),
  );
}
