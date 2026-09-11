import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
it('bootstraps an empty private database once and refuses to replace accounts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'nwc-bootstrap-test-'));
  const env = {
    ...process.env,
    NWC_DATA_DIR: dir,
    NWC_ADMIN_USERNAME: 'test_admin',
    NWC_ADMIN_PASSWORD: 'Synthetic-Bootstrap-Test-2026',
  };
  const invoke = () =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/bootstrap-admin.ts'], {
      env,
      encoding: 'utf8',
      timeout: 15000,
    });
  expect(invoke().status).toBe(0);
  const db = new DatabaseSync(path.join(dir, 'nwc_local.db'), { readOnly: true });
  const before = db.prepare('SELECT username,password_hash FROM users').get();
  expect(before?.username).toBe('test_admin');
  env.NWC_ADMIN_PASSWORD = 'Different-Synthetic-Password';
  expect(invoke().status).toBe(1);
  expect(db.prepare('SELECT username,password_hash FROM users').get()).toEqual(before);
  expect(db.prepare('SELECT count(*) n FROM users').get()?.n).toBe(1);
  db.close();
}, 30000);
