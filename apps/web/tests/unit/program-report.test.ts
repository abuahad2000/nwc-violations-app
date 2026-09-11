import { expect, it } from 'vitest';
import {
  buildProgramReports,
  programEmail,
  type ProgramProject,
  type ProgramViolation,
} from '@/lib/domain/program-report';
const project: ProgramProject = {
  id: 'p1',
  name: 'مشروع مياه',
  operational_number: '1',
  contractor_name: 'مقاول أ',
  project_manager_name: 'مدير مشروع',
  program_manager_name: 'مدير برنامج',
  program_key: 'manager',
  status: 'ACTIVE',
};
const row: ProgramViolation = {
  id: 'v1',
  source_reference: 'OPEN-1',
  project_id: 'p1',
  source_status: 'معاد من المقاول',
  is_closed: 0,
  age_days: 181,
  district_raw: 'حي',
  reported_date: '2025-01-01',
  project_name: project.name,
  contractor_name: project.contractor_name,
  project_manager_name: project.project_manager_name,
  program_key: 'manager',
  program_manager_name: project.program_manager_name,
};
it('includes all nonclosed source statuses, excludes closed from pending, and retains zero-count managers', () => {
  const r = buildProgramReports(
    [
      project,
      { ...project, id: 'p2', program_key: 'zero', program_manager_name: 'مدير بلا بلاغات' },
    ],
    [
      row,
      {
        ...row,
        id: 'v2',
        source_reference: 'CLOSED-2',
        is_closed: 1,
        source_status: 'تمت المعالجة',
      },
      { ...row, id: 'v3', source_reference: 'UNKNOWN-3', program_key: '' },
      {
        ...row,
        id: 'v4',
        source_reference: 'OPEN-4',
        age_days: null,
        source_status: 'تحت معالجة المقاول',
      },
    ],
  );
  expect(r.managers[0]).toMatchObject({ total: 3, closed: 1, open: 2, contractor: 1, over180: 1 });
  expect(r.managers[1].total).toBe(0);
  expect(r.unassigned_open).toBe(1);
  expect(r.managers.reduce((n, m) => n + m.total, 0) + r.unassigned).toBe(r.total);
  expect(r.managers[0].aging.reduce((n, b) => n + b.count, 0)).toBe(2);
  const email = programEmail(r.managers[0], '2026-09-12');
  expect(email).toContain('OPEN-1');
  expect(email).toContain('OPEN-4');
  expect(email).not.toContain('CLOSED-2');
  expect(email).not.toContain('UNKNOWN-3');
});
