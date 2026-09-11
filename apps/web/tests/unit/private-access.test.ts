import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { validAccessToken } from '@/lib/auth/private-access';
it('accepts only the full private token and rejects malformed or forged values', () => {
  const token = 'a'.repeat(43);
  const hash = createHash('sha256').update(token).digest('hex');
  expect(validAccessToken(token, hash)).toBe(true);
  expect(validAccessToken('b'.repeat(43), hash)).toBe(false);
  expect(validAccessToken('', hash)).toBe(false);
  expect(validAccessToken(token, 'invalid')).toBe(false);
});
