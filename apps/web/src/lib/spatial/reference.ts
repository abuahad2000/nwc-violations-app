import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db/async';
import { postgis } from './postgis';
import crypto from 'node:crypto';
import type { PolygonGeometry } from '@/types';
type Project = {
  id: string;
  operational_number: string;
  name: string;
  contractor_id: string | null;
  contractor_name: string;
  source_status: string;
  status: string;
  scope_description: string | null;
  program_manager_name: string | null;
  project_manager_name: string | null;
};
type Boundary = {
  id: string;
  name: string;
  source_file: string;
  file_hash: string;
  folders: string[];
  color: string | null;
  geometry: PolygonGeometry;
  project_id: string | null;
  match_method: string;
  candidates: { project_id: string; name: string; operational_number: string; score: number }[];
};
export async function initializeReference(userId: string) {
  const data = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/reference-review.json'), 'utf8'),
  ) as { projects: Project[]; boundaries: Boundary[] };
  await db.exec(`CREATE TABLE IF NOT EXISTS reference_candidates (id TEXT PRIMARY KEY, name TEXT NOT NULL, source_file TEXT NOT NULL, color TEXT, geometry_json TEXT NOT NULL, proposed_project_id TEXT, match_method TEXT, candidates_json TEXT, approved INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS projects_before_reference AS SELECT * FROM projects;
 CREATE TABLE IF NOT EXISTS project_boundaries_before_reference AS SELECT * FROM project_boundaries;`);
  const now = new Date().toISOString();
  const ids = new Map<string, string>();
  return await db.transaction(async () => {
    // Preserve old records but exclude projects that are not in the authoritative workbook.
    await db.exec("UPDATE projects SET status='REVIEW'");
    for (const project of data.projects) {
      if (!project.contractor_id) continue;
      let contractor = await db
        .prepare('SELECT id FROM contractors WHERE name=?')
        .get(project.contractor_name);
      if (!contractor) {
        await db
          .prepare('INSERT INTO contractors VALUES (?,?,1,?)')
          .run(project.contractor_id, project.contractor_name, now);
        contractor = { id: project.contractor_id };
      }
      const existing = await db
        .prepare('SELECT id FROM projects WHERE operational_number=?')
        .get(project.operational_number);
      const id = String(existing?.id || project.id);
      ids.set(project.id, id);
      await db
        .prepare(
          `INSERT INTO projects (id,operational_number,name,scope_description,status,contractor_id,program_manager_name,project_manager_name,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(operational_number) DO UPDATE SET name=excluded.name,scope_description=excluded.scope_description,status=excluded.status,contractor_id=excluded.contractor_id,program_manager_name=excluded.program_manager_name,project_manager_name=excluded.project_manager_name`,
        )
        .run(
          id,
          project.operational_number,
          project.name,
          project.scope_description,
          project.status,
          contractor.id,
          project.program_manager_name,
          project.project_manager_name,
          now,
        );
    }
    const currentIds = data.boundaries.map((b) => b.id);
    if (currentIds.length)
      await db
        .prepare(
          `UPDATE project_boundaries SET is_approved=0 WHERE id IN (SELECT id FROM reference_candidates) AND id NOT IN (${currentIds.map(() => '?').join(',')})`,
        )
        .run(...currentIds);
    for (const boundary of data.boundaries) {
      const id = boundary.project_id ? ids.get(boundary.project_id) || null : null;
      await db
        .prepare(
          'INSERT INTO reference_candidates (id,name,source_file,color,geometry_json,proposed_project_id,match_method,candidates_json) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET proposed_project_id=excluded.proposed_project_id,match_method=excluded.match_method,candidates_json=excluded.candidates_json WHERE reference_candidates.approved=0',
        )
        .run(
          boundary.id,
          boundary.name,
          boundary.source_file,
          boundary.color,
          JSON.stringify(boundary.geometry),
          id,
          boundary.match_method,
          JSON.stringify(
            boundary.candidates.map((c) => ({ ...c, project_id: ids.get(c.project_id) || null })),
          ),
        );
    }
    await db
      .prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)')
      .run(
        crypto.randomUUID(),
        'PROJECT_REFERENCE_SYNC',
        'REFERENCE',
        'project-workbook',
        userId,
        JSON.stringify({ projects: data.projects.length, boundaries: data.boundaries.length }),
        now,
      );

    return { projects: data.projects.length, boundaries: data.boundaries.length };
  });
}
export async function approveBoundary(boundaryId: string, projectId: string, userId: string) {
  const candidate = await db
    .prepare('SELECT * FROM reference_candidates WHERE id=?')
    .get(boundaryId);
  const project = await db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
  if (!candidate || !project || project.status === 'REVIEW')
    throw new Error('اختر نطاقًا ومشروعًا من المرجع المعتمد');
  if (candidate.approved) {
    if (candidate.proposed_project_id === projectId) return;
    throw new Error('الربط معتمد؛ تعديل المشروع يتطلب إصدار نطاق جديد');
  }
  const valid = await postgis().query<{ valid: boolean }>(
    `SELECT ST_IsValid(ST_GeomFromGeoJSON($1)) AND ST_GeometryType(ST_GeomFromGeoJSON($1)) IN ('ST_Polygon','ST_MultiPolygon') AS valid`,
    [candidate.geometry_json],
  );
  if (!valid.rows[0]?.valid) throw new Error('الهندسة غير صالحة؛ يجب تصحيح المصدر دون إصلاح صامت');
  const now = new Date().toISOString();
  return await db.transaction(async () => {
    await db
      .prepare(
        'INSERT INTO project_boundaries (id,project_id,version,geometry_json,is_approved,created_at) VALUES (?,?,1,?,1,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,is_approved=1',
      )
      .run(boundaryId, projectId, candidate.geometry_json, now);
    await db
      .prepare('UPDATE reference_candidates SET approved=1,proposed_project_id=? WHERE id=?')
      .run(projectId, boundaryId);
    await db
      .prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)')
      .run(
        crypto.randomUUID(),
        'BOUNDARY_APPROVED',
        'BOUNDARY',
        boundaryId,
        userId,
        JSON.stringify({ projectId, source: candidate.source_file, color: candidate.color }),
        now,
      );
  });
}
