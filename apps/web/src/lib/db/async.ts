import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, types } from 'pg';
import type { SQLInputValue, SQLOutputValue } from 'node:sqlite';
export { hashPassword, verifyPassword } from './index';

type Row = Record<string, SQLOutputValue>;
const context = new AsyncLocalStorage<PoolClient | 'sqlite'>();
let pool: Pool | undefined;
let localQueue: Promise<void> = Promise.resolve();
types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds safe range');
  return n;
});

export function postgresPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    statement_timeout: 30000,
  }));
}

// Bind placeholders without changing question marks inside SQL literals.
export function postgresSQL(sql: string) {
  let i = 0;
  let converted = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, (token) =>
    token === '?' ? `$${++i}` : token,
  );
  if (/INSERT OR IGNORE/i.test(converted))
    converted =
      converted.replace(/INSERT OR IGNORE/i, 'INSERT').replace(/;\s*$/, '') +
      ' ON CONFLICT DO NOTHING';
  return converted;
}

async function execute(sql: string, params: SQLInputValue[], mode: 'get' | 'all' | 'run') {
  if (process.env.DATABASE_URL) {
    const client = context.getStore();
    const result = await (client && client !== 'sqlite' ? client : postgresPool()).query(
      postgresSQL(sql),
      params,
    );
    return mode === 'get'
      ? result.rows[0]
      : mode === 'all'
        ? result.rows
        : { changes: result.rowCount ?? 0 };
  }
  if (process.env.NETLIFY) throw new Error('Cloud database is not configured');
  if (!context.getStore()) await localQueue;
  const { db: local } = await import('./index');
  return local.prepare(sql)[mode](...params);
}

export const db = {
  prepare(sql: string) {
    return {
      get: (...params: SQLInputValue[]) => execute(sql, params, 'get') as Promise<Row | undefined>,
      all: (...params: SQLInputValue[]) => execute(sql, params, 'all') as Promise<Row[]>,
      run: (...params: SQLInputValue[]) =>
        execute(sql, params, 'run') as Promise<{ changes: number | bigint }>,
    };
  },
  async exec(sql: string) {
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql))
      throw new Error('Use db.transaction for atomic work');
    if (process.env.DATABASE_URL) {
      const client = context.getStore();
      await (client && client !== 'sqlite' ? client : postgresPool()).query(postgresSQL(sql));
    } else {
      if (process.env.NETLIFY) throw new Error('Cloud database is not configured');
      if (!context.getStore()) await localQueue;
      (await import('./index')).db.exec(sql);
    }
  },
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (context.getStore()) throw new Error('Nested transactions are not supported');
    if (process.env.DATABASE_URL) {
      const client = await postgresPool().connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const result = await context.run(client, work);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (process.env.NETLIFY) throw new Error('Cloud database is not configured');
    const previous = localQueue;
    let release!: () => void;
    localQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const { db: local } = await import('./index');
      local.exec('BEGIN IMMEDIATE');
      try {
        const result = await context.run('sqlite', work);
        local.exec('COMMIT');
        return result;
      } catch (error) {
        local.exec('ROLLBACK');
        throw error;
      }
    } finally {
      release();
    }
  },
};
