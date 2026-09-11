import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { programKeySQL, programNameSQL } from '@/lib/domain/manager';
it('merges only owner-approved program identities in reporting and filter SQL', () => {
  const db = new DatabaseSync(':memory:');
  const query = db.prepare(
    `SELECT ${programKeySQL} key,${programNameSQL} name FROM (SELECT ? program_manager_name) p`,
  );
  for (const value of ['م. تركي الاسمري', 'تركي ظافر يحيى الاسمري', 'تركي ظافر الاسمري'])
    expect(query.get(value)).toEqual({ key: 'تركي ظافر الاسمري', name: 'تركي ظافر الاسمري' });
  for (const value of ['م. عبدالله العنزي', 'عبدالله علي العنزي'])
    expect(query.get(value)).toEqual({ key: 'عبدالله علي العنزي', name: 'عبدالله علي العنزي' });
  expect(query.get('م. عبدالله الاسود')?.key).not.toBe('عبدالله علي العنزي');
  expect(query.get('عبدالله الأسود العنزي')?.key).not.toBe('عبدالله علي العنزي');
  for (const value of [
    'م. عبدالله الاسود',
    'عبدالله الأسود',
    'عبدالله الاسود العنزي',
    'عبدالله الأسود العنزي',
  ])
    expect(query.get(value)).toEqual({
      key: 'عبدالله الاسود العنزي',
      name: 'عبدالله الأسود العنزي',
    });
  db.close();
});
