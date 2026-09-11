import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import * as XLSX from 'xlsx';
import { applyRepairs } from '@/lib/db/repairs';
const isolated = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock('@/lib/db', () => ({
  get db() {
    return isolated.db;
  },
}));
import { previewImport, commitImport } from '@/lib/imports/service';
import { normalizeSource, readWorkbook } from '@/lib/imports/workbook';
function workbook(status = 'تمت المعالجة') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { 'رقم بلاغ التعدي': '00007', 'حالة البلاغ': status, 'خط العرض': null, 'خط الطول': null },
    ]),
    'data',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
describe('Real import preview and commit on isolated database', () => {
  beforeAll(() => {
    const db = new DatabaseSync(':memory:');
    isolated.db = db;
    db.exec(
      `CREATE TABLE users (id TEXT,must_change_password INTEGER);CREATE TABLE contractors(id TEXT PRIMARY KEY,name TEXT UNIQUE,is_approved INTEGER,created_at TEXT);CREATE TABLE projects(id TEXT);CREATE TABLE project_boundaries(id TEXT,is_approved INTEGER);CREATE TABLE violations(id TEXT PRIMARY KEY,source_reference TEXT UNIQUE,reported_contractor_name TEXT,reported_contractor_id TEXT,project_contractor_id TEXT,current_action_owner_id TEXT,project_id TEXT,latitude REAL,longitude REAL,classification TEXT,classification_reason TEXT,source_status TEXT,reported_date TEXT,incident_date TEXT,age_days INTEGER,description_raw TEXT,district_raw TEXT,street_raw TEXT,city_raw TEXT,is_closed INTEGER,import_batch_id TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE import_batches(id TEXT PRIMARY KEY,filename TEXT,file_hash TEXT,total_rows INTEGER,imported_rows INTEGER,status TEXT,imported_by TEXT,created_at TEXT);CREATE TABLE audit_events(id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,performed_by TEXT,details TEXT,created_at TEXT);`,
    );
    applyRepairs(db);
  });
  afterAll(() => isolated.db?.close());
  it('treats processed as closed and preserves leading zeros / missing coordinates', () => {
    expect(
      normalizeSource({
        'رقم بلاغ التعدي': '00007',
        'حالة البلاغ': 'تمت المعالجة',
        'خط العرض': '',
      }),
    ).toMatchObject({ source_reference: '00007', is_closed: 1, latitude: null });
  });
  it('preview does not change records; wrong owner cannot commit', async () => {
    const p = await previewImport(workbook(), 'synthetic.xlsx', 'admin');
    expect(isolated.db!.prepare('SELECT count(*) n FROM violations').get()!.n).toBe(0);
    await expect(commitImport(p.preview_id, 'other')).rejects.toThrow();
    expect((await commitImport(p.preview_id, 'admin')).imported_rows).toBe(1);
  });
  it('reimport is idempotent and does not replace the existing record', async () => {
    const p = await previewImport(workbook(), 'synthetic.xlsx', 'admin');
    expect((await commitImport(p.preview_id, 'admin')).duplicate).toBe(true);
    expect(isolated.db!.prepare('SELECT count(*) n FROM violations').get()!.n).toBe(1);
  });
  it('changed source is versioned before updating', async () => {
    const p = await previewImport(workbook('تحت معالجة المقاول'), 'changed.xlsx', 'admin');
    expect(p.changed).toBe(1);
    expect((await commitImport(p.preview_id, 'admin')).imported_rows).toBe(1);
    expect(isolated.db!.prepare('SELECT count(*) n FROM source_versions').get()!.n).toBe(3);
    expect(isolated.db!.prepare('SELECT is_closed FROM violations').get()!.is_closed).toBe(0);
  });
  it('rejects arbitrary files', async () => {
    await expect(readWorkbook(Buffer.from('not a workbook'))).rejects.toThrow();
  });
});
