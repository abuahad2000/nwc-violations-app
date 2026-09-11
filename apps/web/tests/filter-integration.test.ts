import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import type { SessionUser } from '@/types';
const reader: SessionUser = { id: 'r', name: 'test', email: 'r@example.test', role: 'READER' };
describe('Shared report and listing filters', () => {
  it('rejects malformed pagination and unknown classifications', () => {
    for (const q of ['page=NaN', 'limit=200', 'page=-1', 'classification=wrong'])
      expect(() => parseFilters(new URLSearchParams(q))).toThrow();
  });
  it('encodes 181+ correctly and never includes closed records', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE violations (id TEXT,age_days INTEGER,is_closed INTEGER); INSERT INTO violations VALUES ('open',181,0),('closed',300,1),('edge',180,0)",
    );
    const { whereSQL, params } = buildViolationFilter(
      parseFilters(new URLSearchParams({ aging: '181+' })),
      reader,
    );
    expect(
      db
        .prepare(`SELECT id FROM violations v WHERE ${whereSQL}`)
        .all(...params)
        .map((r) => r.id),
    ).toEqual(['open']);
    db.close();
  });
  it('does not grant contractor access through reported name or geometry', () => {
    const user = { ...reader, role: 'CONTRACTOR_USER' as const, contractor_id: 'A' };
    const result = buildViolationFilter(parseFilters(new URLSearchParams()), user);
    expect(result.whereSQL).toBe('v.current_action_owner_id = ?');
    expect(result.params).toEqual(['A']);
    expect(
      buildViolationFilter(parseFilters(new URLSearchParams()), { ...user, contractor_id: null })
        .whereSQL,
    ).toBe('0=1');
  });
  it('uses bound parameters and includes project_id for exports too', () => {
    const { whereSQL, params } = buildViolationFilter(
      parseFilters(new URLSearchParams({ project_id: 'p1', search: "' OR 1=1 --" })),
      reader,
    );
    expect(whereSQL).not.toContain("' OR 1=1 --");
    expect(whereSQL).toContain('v.project_id = ?');
    expect(params.at(-1)).toBe('p1');
  });
});
