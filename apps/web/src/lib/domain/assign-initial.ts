import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db/async';
import { initialResponsibility, type ResponsibilityProject } from './responsibility';
export async function assignInitial(id: string, userId: string, projects: ResponsibilityProject[]) {
  const row = await db.prepare('SELECT * FROM violations WHERE id=?').get(id);
  if (!row) return;
  if (row.current_action_owner_id) {
    if (
      !row.is_closed &&
      !(await db.prepare("SELECT id FROM tasks WHERE violation_id=? AND status='OPEN'").get(id))
    ) {
      await db
        .prepare(
          "INSERT INTO tasks(id,violation_id,owner_id,reason,status,version,created_by,created_at) VALUES(?,?,?,?,'OPEN',1,?,?)",
        )
        .run(
          randomUUID(),
          id,
          String(row.current_action_owner_id),
          'استئناف المتابعة بعد تحديث المصدر',
          userId,
          new Date().toISOString(),
        );
    }
    return;
  }
  const choice = initialResponsibility(
    {
      project_id: row.project_id as string | null,
      reported_contractor_id: row.reported_contractor_id as string | null,
    },
    projects,
  );
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE tasks SET status='SUPERSEDED',version=version+1 WHERE violation_id=? AND status='OPEN'",
    )
    .run(id);
  await db
    .prepare(
      'UPDATE violations SET current_action_owner_id=?,project_id=?,project_contractor_id=?,updated_at=? WHERE id=?',
    )
    .run(choice.owner_id, choice.project_id, choice.project_id ? choice.owner_id : null, now, id);
  if (!row.is_closed)
    await db
      .prepare(
        "INSERT INTO tasks(id,violation_id,owner_id,reason,status,version,created_by,created_at) VALUES(?,?,?,?,'OPEN',1,?,?)",
      )
      .run(randomUUID(), id, choice.owner_id, choice.reason, userId, now);
  await db
    .prepare(
      'INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      randomUUID(),
      'INITIAL_RESPONSIBILITY',
      'VIOLATION',
      id,
      userId,
      JSON.stringify(choice),
      now,
    );
}
