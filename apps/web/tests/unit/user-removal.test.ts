import { expect, it } from 'vitest';
import { removalReason, type ManagedUser } from '@/lib/auth/user-removal';
const user: ManagedUser = {
  id: 'other',
  name: 'test',
  email: 'test@example.test',
  username: null,
  role: 'READER',
  created_at: '',
  active_sessions: 0,
  activity: 0,
};
it('only permits unused accounts and protects self, activity, sessions and the last admin', () => {
  expect(removalReason(user, 'admin', 1)).toBe('');
  expect(removalReason(user, 'other', 1)).not.toBe('');
  expect(removalReason({ ...user, active_sessions: 1 }, 'admin', 2)).not.toBe('');
  expect(removalReason({ ...user, activity: 1 }, 'admin', 2)).not.toBe('');
  expect(removalReason({ ...user, role: 'SUPER_ADMIN' }, 'admin', 1)).not.toBe('');
});
