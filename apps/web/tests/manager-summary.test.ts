import { describe, it, expect } from 'vitest';
import { summarizeManagers } from '../src/lib/domain/manager';
describe('manager source status accounting', () => {
  it('counts processing without double-counting contractor; keeps unassigned separate', () => {
    const result = summarizeManagers(
      [
        { key: 'manager', name: 'مدير' },
        { key: 'empty', name: 'مدير بلا سجلات' },
      ],
      [
        { key: 'manager', name: 'مدير', status: 'تحت معالجة المقاول', count: 8, closed: 0 },
        { key: 'manager', name: 'مدير', status: 'تحت معالجة الجهة المتعدية', count: 3, closed: 0 },
        { key: 'manager', name: 'مدير', status: 'تمت المعالجة', count: 5, closed: 5 },
        { key: 'manager', name: 'مدير', status: 'معاد من المقاول', count: 2, closed: 0 },
        { key: '', name: '', status: 'تحت معالجة المقاول', count: 7, closed: 0 },
      ],
    );
    expect(result.unassigned).toBe(7);
    expect(result.managers[0]).toMatchObject({
      total: 18,
      processing: 11,
      contractor: 8,
      closed: 5,
      other: 2,
    });
    expect(
      result.managers[0].processing + result.managers[0].other + result.managers[0].closed,
    ).toBe(18);
    expect(result.managers[1].total).toBe(0);
  });
});
