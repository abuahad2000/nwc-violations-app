import { db } from '@/lib/db';
import { SessionUser, UserRole } from '@/types';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'nwc_session';

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  db.prepare(
    `
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `,
  ).run(token, userId, expiresAt, new Date().toISOString());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  return token;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const row = db
      .prepare(
        `
      SELECT u.id, u.name, u.email, u.role, u.contractor_id, u.must_change_password, s.expires_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `,
      )
      .get(token) as
      | {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          contractor_id: string | null;
          expires_at: string;
          must_change_password: number;
        }
      | undefined;

    if (!row) return null;

    if (new Date(row.expires_at).getTime() < Date.now()) {
      // Session expired
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      contractor_id: row.contractor_id,
      must_change_password: Boolean(row.must_change_password),
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
