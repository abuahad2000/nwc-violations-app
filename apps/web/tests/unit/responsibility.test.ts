import { it, expect } from 'vitest';
import { initialResponsibility } from '@/lib/domain/responsibility';
it('uses the linked project, a unique contractor project, or an explicit fallback without guessing between projects', () => {
  const p = [
    { id: 'one', name: 'أ', contractor_id: 'a' },
    { id: 'two', name: 'ب', contractor_id: 'b' },
    { id: 'three', name: 'ج', contractor_id: 'b' },
  ];
  expect(
    initialResponsibility({ project_id: 'one', reported_contractor_id: 'b' }, p),
  ).toMatchObject({ project_id: 'one', owner_id: 'a' });
  expect(initialResponsibility({ project_id: null, reported_contractor_id: 'a' }, p)).toMatchObject(
    { project_id: 'one', owner_id: 'a' },
  );
  expect(initialResponsibility({ project_id: null, reported_contractor_id: 'b' }, p)).toMatchObject(
    { project_id: null, owner_id: 'b' },
  );
  expect(
    initialResponsibility({ project_id: null, reported_contractor_id: 'unknown' }, p),
  ).toMatchObject({ project_id: null, owner_id: 'cont_nwc_operations' });
});
