import { describe, it, expect } from 'vitest';
import { canViewViolation, hasPermission, canMutateViolations } from '@/lib/auth/rbac';
import { SessionUser, Violation } from '@/types';

describe('RBAC & Security Invariants (Acceptance Tests S01 - S04)', () => {
  const adminUser: SessionUser = {
    id: 'user-admin',
    name: 'مدير النظام',
    email: 'admin@nwc.com.sa',
    role: 'SUPER_ADMIN',
  };

  const readerUser: SessionUser = {
    id: 'user-reader',
    name: 'قارئ تقارير',
    email: 'reader@nwc.com.sa',
    role: 'READER',
  };

  const contractorAUser: SessionUser = {
    id: 'user-cont-a',
    name: 'مستخدم مقاول شركة الأعمال',
    email: 'user@civilworks.com',
    role: 'CONTRACTOR_USER',
    contractor_id: 'contractor-a',
  };

  const contractorBUser: SessionUser = {
    id: 'user-cont-b',
    name: 'مستخدم مقاول شركة ماءك',
    email: 'user@maak.com',
    role: 'CONTRACTOR_USER',
    contractor_id: 'contractor-b',
  };

  const sampleViolationContractorA: Violation = {
    id: 'viol-1',
    source_reference: 'REF-001',
    reported_contractor_name: 'شركة الأعمال المدنية',
    project_contractor_id: 'contractor-a',
    current_action_owner_id: 'contractor-a',
    project_id: 'proj-1',
    latitude: 24.75,
    longitude: 46.65,
    classification: 'INSIDE_ACTIVE_PROJECT',
    classification_reason: 'داخل نطاق مشروع جاري',
    reported_date: '2026-01-01',
    age_days: 253,
    source_status: 'تحت معالجة المقاول',
    is_closed: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('S01: Unauthenticated visitor has no permissions', () => {
    expect(hasPermission(null, 'violations:read')).toBe(false);
    expect(hasPermission(null, 'violations:write')).toBe(false);
    expect(canViewViolation(null, sampleViolationContractorA)).toBe(false);
    expect(canMutateViolations(null)).toBe(false);
  });

  it('S02: Contractor user cannot view another contractor violations (Row-Level Security)', () => {
    // Contractor A user can view their assigned violation
    expect(canViewViolation(contractorAUser, sampleViolationContractorA)).toBe(true);

    // Contractor B user MUST NOT be able to view Contractor A violation!
    expect(canViewViolation(contractorBUser, sampleViolationContractorA)).toBe(false);
  });

  it('S03: Reader user cannot mutate or write violations', () => {
    expect(hasPermission(readerUser, 'violations:read')).toBe(true);
    expect(hasPermission(readerUser, 'violations:write')).toBe(false);
    expect(canMutateViolations(readerUser)).toBe(false);
  });

  it('S04: Admin has full access to read and mutate', () => {
    expect(canViewViolation(adminUser, sampleViolationContractorA)).toBe(true);
    expect(canMutateViolations(adminUser)).toBe(true);
  });
});
