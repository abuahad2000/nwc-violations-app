import crypto from 'crypto';
import { db } from '@/lib/db/async';
import { readWorkbook } from './workbook';
import { findContractor } from '@/lib/domain/contractor-alias';
import { assignInitial } from '@/lib/domain/assign-initial';
import type { ResponsibilityProject } from '@/lib/domain/responsibility';

export async function previewImport(buffer: Buffer, filename: string, userId: string) {
  const parsed = await readWorkbook(buffer);
  const existing = await db
    .prepare("SELECT id FROM import_batches WHERE file_hash = ? AND status = 'COMPLETED'")
    .get(parsed.file_hash);
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  for (const record of parsed.records) {
    const old = await db
      .prepare('SELECT * FROM violations WHERE source_reference = ?')
      .get(record.normalized.source_reference);
    if (!old) added++;
    else if (Object.entries(record.normalized).some(([key, value]) => old[key] !== value))
      changed++;
    else unchanged++;
  }
  const id = crypto.randomUUID();
  await db
    .prepare('DELETE FROM import_previews WHERE expires_at < ?')
    .run(new Date().toISOString());
  await db
    .prepare('INSERT INTO import_previews VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      id,
      userId,
      filename,
      parsed.file_hash,
      JSON.stringify(parsed),
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    );
  return {
    preview_id: id,
    filename,
    file_hash: parsed.file_hash,
    total_rows: parsed.records.length,
    added,
    changed,
    unchanged,
    is_duplicate: Boolean(existing),
    sample_rows: parsed.records.slice(0, 5).map((r) => r.normalized),
    detected_columns: Object.keys(parsed.records[0].raw),
  };
}
export async function commitImport(id: string, userId: string) {
  return await db.transaction(async () => {
    const preview = await db
      .prepare('SELECT * FROM import_previews WHERE id = ? AND user_id = ? AND expires_at > ?')
      .get(id, userId, new Date().toISOString());
    if (!preview) throw new Error('المعاينة منتهية أو غير متاحة لهذا المستخدم؛ أعد المعاينة');
    const duplicate = await db
      .prepare("SELECT id FROM import_batches WHERE file_hash = ? AND status = 'COMPLETED'")
      .get(preview.file_hash);
    if (duplicate) {
      return { duplicate: true, batch_id: duplicate.id, imported_rows: 0 };
    }
    const data = JSON.parse(String(preview.payload)) as Awaited<ReturnType<typeof readWorkbook>>;
    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();
    let imported = 0;
    await db
      .prepare(
        'INSERT INTO contractors(id,name,is_approved,created_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING',
      )
      .run('cont_nwc_operations', 'إدارة الصيانة', now);
    const assignmentProjects = (await db
      .prepare("SELECT id,name,contractor_id FROM projects WHERE status!='REVIEW'")
      .all()) as ResponsibilityProject[];
    for (const record of data.records) {
      const old = await db
        .prepare('SELECT * FROM violations WHERE source_reference = ?')
        .get(record.normalized.source_reference);
      if (old && !Object.entries(record.normalized).some(([key, value]) => old[key] !== value))
        continue;
      const violationId = old
        ? String(old.id)
        : `viol_${crypto
            .createHash('sha256')
            .update('municipal:' + record.normalized.source_reference)
            .digest('hex')
            .slice(0, 24)}`;
      if (old)
        await db
          .prepare('INSERT INTO source_versions VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), violationId, old.import_batch_id, JSON.stringify(old), now);
      await db
        .prepare('INSERT INTO source_versions VALUES (?, ?, ?, ?, ?)')
        .run(
          crypto.randomUUID(),
          violationId,
          batchId,
          JSON.stringify({ sheet: data.sheet, row: record.row, raw: record.raw }),
          now,
        );
      const resolvedContractor = record.normalized.reported_contractor_name
        ? await findContractor(record.normalized.reported_contractor_name)
        : null;
      const values = {
        ...record.normalized,
        reported_contractor_id: resolvedContractor?.id ?? null,
      };
      const keys = Object.keys(values);
      if (old) {
        await db
          .prepare(
            `UPDATE violations SET ${keys.map((k) => `${k} = ?`).join(', ')}, import_batch_id = ?, updated_at = ?, classification = 'UNDER_REVIEW', classification_reason = 'تغير المصدر؛ يلزم إعادة تصنيف', project_id = CASE WHEN EXISTS(SELECT 1 FROM manual_responsibility mr WHERE mr.violation_id=violations.id) THEN project_id ELSE NULL END, project_contractor_id = CASE WHEN EXISTS(SELECT 1 FROM manual_responsibility mr WHERE mr.violation_id=violations.id) THEN project_contractor_id ELSE NULL END WHERE id = ?`,
          )
          .run(...Object.values(values), batchId, now, violationId);
      } else {
        await db
          .prepare(
            `INSERT INTO violations (id, ${keys.join(',')}, classification, classification_reason, import_batch_id, created_at, updated_at) VALUES (?, ${keys.map(() => '?').join(',')}, 'UNDER_REVIEW', 'بانتظار التصنيف المكاني المعتمد', ?, ?, ?)`,
          )
          .run(violationId, ...Object.values(values), batchId, now, now);
      }
      if (values.is_closed)
        await db
          .prepare(
            "UPDATE tasks SET status='CLOSED_SOURCE',version=version+1 WHERE violation_id=? AND status='OPEN'",
          )
          .run(violationId);
      await assignInitial(violationId, userId, assignmentProjects);
      imported++;
    }
    await db
      .prepare('INSERT INTO import_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        batchId,
        preview.filename,
        preview.file_hash,
        data.records.length,
        imported,
        'COMPLETED',
        userId,
        now,
      );
    await db
      .prepare('INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(
        crypto.randomUUID(),
        'IMPORT_COMMITTED',
        'IMPORT',
        batchId,
        userId,
        JSON.stringify({ imported, total: data.records.length }),
        now,
      );
    await db.prepare('DELETE FROM import_previews WHERE id = ?').run(id);

    return { duplicate: false, batch_id: batchId, imported_rows: imported };
  });
}
