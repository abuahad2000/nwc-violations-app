import { db } from '@/lib/db';
import crypto from 'node:crypto';
import {
  classifyWithPostgis,
  classificationReason,
  type ApprovedBoundary,
  type SpatialInput,
} from './postgis';
export async function reclassify(userId: string) {
  const boundaries = db
    .prepare(
      `SELECT p.id project_id,p.contractor_id,b.geometry_json FROM project_boundaries b JOIN projects p ON p.id=b.project_id WHERE b.is_approved=1 AND p.status='ACTIVE'`,
    )
    .all();
  const active = db.prepare("SELECT count(*) n FROM projects WHERE status='ACTIVE'").get()!;
  const matched = new Set(boundaries.map((b) => b.project_id));
  const complete = Number(active.n) > 0 && matched.size === Number(active.n);
  const snapshot=JSON.stringify(db.prepare('SELECT id,updated_at FROM violations ORDER BY id').all());
  const referenceSnapshot=JSON.stringify(db.prepare('SELECT b.id,b.is_approved,b.project_id,p.status FROM project_boundaries b JOIN projects p ON p.id=b.project_id ORDER BY b.id').all());
  const points = db.prepare('SELECT id,latitude,longitude FROM violations').all() as SpatialInput[];
  const approved = boundaries.map((b) => ({
    project_id: String(b.project_id),
    contractor_id: String(b.contractor_id),
    geometry: JSON.parse(String(b.geometry_json)),
  })) as ApprovedBoundary[];
  const results = await classifyWithPostgis(points, approved, complete);
  db.exec('BEGIN IMMEDIATE');
  try {
    if(snapshot!==JSON.stringify(db.prepare('SELECT id,updated_at FROM violations ORDER BY id').all())||referenceSnapshot!==JSON.stringify(db.prepare('SELECT b.id,b.is_approved,b.project_id,p.status FROM project_boundaries b JOIN projects p ON p.id=b.project_id ORDER BY b.id').all())) throw new Error('تغيرت البيانات أثناء التصنيف؛ أعد المحاولة');
    const now = new Date().toISOString();
    const run = crypto.randomUUID();
    db.prepare(
      'INSERT OR IGNORE INTO contractors (id,name,is_approved,created_at) VALUES (?,?,1,?)',
    ).run('cont_nwc_operations', 'إدارة الصيانة', now);
    for (const result of results) {
      const group =
        result.classification === 'INSIDE_ACTIVE_PROJECT'
          ? 'INSIDE_PROJECT_BOUNDARY'
          : result.classification === 'OUTSIDE_ACTIVE_PROJECTS'
            ? 'OUTSIDE_PROJECT_BOUNDARY'
            : 'UNDER_REVIEW';
      const old = db.prepare('SELECT * FROM violations WHERE id=?').get(result.id)!;
      db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)').run(
        crypto.randomUUID(),
        'SPATIAL_CLASSIFICATION',
        'VIOLATION',
        result.id,
        userId,
        JSON.stringify({
          run,
          previous: { classification: old.classification, project_id: old.project_id },
          result,
          reference_complete: complete,
        }),
        now,
      );
      db.prepare(
        'UPDATE violations SET classification=?,classification_reason=?,project_id=?,project_contractor_id=?,updated_at=? WHERE id=?',
      ).run(
        group,
        classificationReason[result.classification],
        result.project_id,
        result.contractor_id,
        now,
        result.id,
      );
      // User-approved rule: first assignment only. Existing tasks are never reassigned by geometry.
      const owner =
        result.classification === 'INSIDE_ACTIVE_PROJECT'
          ? result.contractor_id
          : result.classification === 'OUTSIDE_ACTIVE_PROJECTS'
            ? 'cont_nwc_operations'
            : null;
      if (owner && !old.current_action_owner_id && !old.is_closed) {
        db.prepare(
          "INSERT OR IGNORE INTO tasks (id,violation_id,owner_id,reason,status,created_by,created_at) VALUES (?,?,?,?,'OPEN',?,?)",
        ).run(
          crypto.randomUUID(),
          result.id,
          owner,
          classificationReason[result.classification],
          userId,
          now,
        );
        db.prepare('UPDATE violations SET current_action_owner_id=? WHERE id=?').run(
          owner,
          result.id,
        );
      }
    }
    db.exec('COMMIT');
    return {
      total: results.length,
      reference_complete: complete,
      active_projects: Number(active.n),
      matched_active_projects: matched.size,
      counts: results.reduce<Record<string, number>>((a, r) => {
        a[r.classification] = (a[r.classification] || 0) + 1;
        return a;
      }, {}),
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
