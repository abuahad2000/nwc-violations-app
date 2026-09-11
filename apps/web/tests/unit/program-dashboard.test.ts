import { describe, it, expect } from 'vitest';
import { summarizeProgramDashboard } from '@/lib/domain/program-dashboard';
describe('program dashboard hierarchy', () => {
  it('keeps project managers scoped to their program and reconciles unassigned records', () => {
    const person = {
      program_key: 'a',
      program_name: 'برنامج أ',
      manager_key: 'm',
      manager_name: 'مدير',
    };
    const result = summarizeProgramDashboard(
      [person, { ...person, program_key: 'zero' }],
      [
        { ...person, total: 5, pending: 3, contractor: 2 },
        {
          ...person,
          program_key: 'b',
          program_name: 'برنامج ب',
          total: 4,
          pending: 4,
          contractor: 1,
        },
        { ...person, program_key: '', total: 7, pending: 6, contractor: 3 },
      ],
    );
    expect(result.assigned).toEqual({ total: 9, pending: 7, contractor: 3 });
    expect(result.unassigned).toEqual({ total: 7, pending: 6, contractor: 3 });
    expect(result.programs.map((p) => p.key)).toEqual(['b', 'a', 'zero']);
    expect(result.programs[0].managers[0].pending).toBe(4);
    expect(result.programs[1].managers[0].pending).toBe(3);
    expect(result.programs[2].pending).toBe(0);
  });
});
