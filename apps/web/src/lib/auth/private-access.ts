import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db/async';
export const ACCESS_COOKIE = 'nwc_private_access';
export const ACCESS_SETTING = 'private_access_token_sha256';
export function validAccessToken(token: string, hash: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(hash, 'hex'));
}
export async function accessHash() {
  const setting = await db
    .prepare('SELECT value FROM system_settings WHERE key=?')
    .get(ACCESS_SETTING);
  return setting ? String(setting.value) : null;
}
export async function hasSiteAccess() {
  const store = await cookies();
  const hash = await accessHash();
  // The deployment is enabled explicitly after the private entry flow has been verified.
  return hash === null || validAccessToken(store.get(ACCESS_COOKIE)?.value || '', hash);
}
