import { SessionUser, UserRole, Violation } from '@/types';

export type Permission =
  | 'violations:read'
  | 'violations:write'
  | 'violations:classify'
  | 'projects:read'
  | 'projects:write'
  | 'contractors:read'
  | 'contractors:write'
  | 'imports:execute'
  | 'reports:export'
  | 'audit:read';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'violations:read',
    'violations:write',
    'violations:classify',
    'projects:read',
    'projects:write',
    'contractors:read',
    'contractors:write',
    'imports:execute',
    'reports:export',
    'audit:read',
  ],
  PROGRAM_MANAGER: [
    'imports:execute',
    'violations:read',
    'violations:write',
    'violations:classify',
    'projects:read',
    'projects:write',
    'contractors:read',
    'reports:export',
  ],
  PROJECT_MANAGER: [
    'violations:read',
    'violations:write',
    'projects:read',
    'contractors:read',
    'reports:export',
  ],
  EDITOR: [
    'violations:read',
    'violations:write',
    'projects:read',
    'contractors:read',
    'reports:export',
  ],
  READER: ['violations:read', 'projects:read', 'contractors:read', 'reports:export'],
  CONTRACTOR_USER: ['violations:read', 'reports:export'],
};

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

/**
 * Row-Level Authorization: checks whether a user has permission to view a specific violation.
 * Contractor users can ONLY view violations where either:
 * 1. The violation's assigned contractor matches their contractor_id, OR
 * 2. The violation's reported contractor matches their contractor_id
 * They CANNOT view other contractors' violations (Test S02).
 */
export function canViewViolation(user: SessionUser | null, violation: Violation): boolean {
  if (!user) return false;
  if (!hasPermission(user, 'violations:read')) return false;

  if (user.role === 'CONTRACTOR_USER') {
    if (!user.contractor_id) return false;
    const matchesCurrentAction = violation.current_action_owner_id === user.contractor_id;
    return matchesCurrentAction;
  }

  return true;
}

/**
 * Validates that mutation is strictly authorized
 */
export function canMutateViolations(user: SessionUser | null): boolean {
  return hasPermission(user, 'violations:write');
}
