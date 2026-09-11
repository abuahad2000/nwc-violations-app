import { describe, it, expect } from 'vitest';
import { summarizeProgramDashboard, executiveHierarchy } from '@/lib/domain/program-dashboard';
describe('program dashboard hierarchy', () => {
  it('separates the same program manager under distinct executives',()=>{
    const row={program_key:'program',program_name:'مدير البرنامج',manager_key:'manager',manager_name:'مدير المشروع',subprogram:'مياه',total:4,pending:3,contractor:2};
    const groups=executiveHierarchy([{...row,executive:'تنفيذي أ'},{...row,executive:'تنفيذي ب',total:2,pending:1,contractor:0}]);
    expect(groups).toHaveLength(2);expect(groups[0].assigned.pending).toBe(3);expect(groups[1].assigned.pending).toBe(1);
    expect(groups[0].programs[0].managers[0].total).toBe(4);expect(groups[1].programs[0].managers[0].total).toBe(2);
  });
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
    expect(result.programs.map((p) => p.key)).toEqual(['b', 'a']);
    expect(result.programs[0].managers[0].pending).toBe(4);
    expect(result.programs[1].managers[0].pending).toBe(3);
    expect(result.programs).toHaveLength(2);
  });
});
