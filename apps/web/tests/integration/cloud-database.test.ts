import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import { postgresSQL } from '@/lib/db/async';

it('binds placeholders without rewriting quoted question marks', () => {
  expect(postgresSQL("SELECT '?' literal, id FROM users WHERE id=? AND name='it''s?'")).toBe(
    "SELECT '?' literal, id FROM users WHERE id=$1 AND name='it''s?'",
  );
});

describe.skipIf(!process.env.NWC_TEST_POSTGRES_URL)(
  'PostgreSQL persistence and transaction isolation',
  () => {
    const schema = 'nwc_test_' + crypto.randomBytes(8).toString('hex');
    let admin: Pool;
    let db: typeof import('@/lib/db/async').db;
    let close: () => Promise<void>;
    const previous = process.env.DATABASE_URL;
    beforeAll(async () => {
      admin = new Pool({ connectionString: process.env.NWC_TEST_POSTGRES_URL, max: 1 });
      await admin.query(`CREATE SCHEMA ${schema}`);
      const url = new URL(process.env.NWC_TEST_POSTGRES_URL!);

      process.env.DATABASE_URL = url.toString();
      const databaseModule = await import('@/lib/db/async');
      db = databaseModule.db;
      close = () => databaseModule.postgresPool().end();
      await db.exec(`CREATE TABLE ${schema}.counter(id TEXT PRIMARY KEY, value INTEGER NOT NULL)`);
      await db.prepare(`INSERT INTO ${schema}.counter VALUES (?,?)`).run('item', 0);
    }, 30000);
    afterAll(async () => {
      await close?.();
      await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin?.end();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    });
    it('rolls back the entire transaction on failure', async () => {
      await expect(
        db.transaction(async () => {
          await db.prepare(`UPDATE ${schema}.counter SET value=? WHERE id=?`).run(10, 'item');
          await db.prepare(`INSERT INTO ${schema}.counter VALUES (?,?)`).run('item', 20);
        }),
      ).rejects.toThrow();
      expect(
        (await db.prepare(`SELECT value FROM ${schema}.counter WHERE id=?`).get('item'))?.value,
      ).toBe(0);
    });
    it('commits once and preserves values on an independent connection', async () => {
      await db.transaction(async () => {
        await db.prepare(`UPDATE ${schema}.counter SET value=? WHERE id=?`).run(7, 'item');
      });
      expect((await admin.query(`SELECT value FROM ${schema}.counter`)).rows[0].value).toBe(7);
    });
    it('does not mix concurrent transactions or silently lose updates', async () => {
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let readers = 0;
      const increment = () =>
        db.transaction(async () => {
          const row = await db
            .prepare(`SELECT value FROM ${schema}.counter WHERE id=?`)
            .get('item');
          if (++readers === 2) release();
          await barrier;
          await db
            .prepare(`UPDATE ${schema}.counter SET value=? WHERE id=?`)
            .run(Number(row!.value) + 1, 'item');
        });
      const results = await Promise.allSettled([increment(), increment()]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(
        (await db.prepare(`SELECT value FROM ${schema}.counter WHERE id=?`).get('item'))?.value,
      ).toBe(8);
    }, 30000);
  },
);
