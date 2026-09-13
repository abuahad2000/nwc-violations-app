import { describe, expect, it } from 'vitest';
import { CLIENT_ACCOUNT_MANAGER, initialResponsibility, responsibilityLabel } from '@/lib/domain/responsibility';

describe('responsibility routing', () => {
  it('uses the linked project, a unique contractor project, or an explicit fallback', () => {
    const p = [
      { id: 'one', name: 'أ', contractor_id: 'a' },
      { id: 'two', name: 'ب', contractor_id: 'b' },
      { id: 'three', name: 'ج', contractor_id: 'b' },
    ];
    expect(initialResponsibility({ project_id: 'one', reported_contractor_id: 'b' }, p)).toMatchObject({ project_id: 'one', owner_id: 'a' });
    expect(initialResponsibility({ project_id: null, reported_contractor_id: 'a' }, p)).toMatchObject({ project_id: 'one', owner_id: 'a' });
    expect(initialResponsibility({ project_id: null, reported_contractor_id: 'b' }, p)).toMatchObject({ project_id: null, owner_id: 'b' });
    expect(initialResponsibility({ project_id: null, reported_contractor_id: 'unknown' }, p)).toMatchObject({ project_id: null, owner_id: 'cont_nwc_operations' });
  });
  it('keeps client-account routing separate from a project', () => {
    expect(responsibilityLabel('CLIENT_ACCOUNT')).toBe('تنفيذ على حساب العميل');
    expect(CLIENT_ACCOUNT_MANAGER).toBe('عبدالله الأسود');
  });
  it('uses maintenance as the default non-project route', () => {
    expect(responsibilityLabel('MAINTENANCE')).toBe('إدارة الصيانة');
    expect(responsibilityLabel(null)).toBe('إدارة الصيانة');
  });
});
