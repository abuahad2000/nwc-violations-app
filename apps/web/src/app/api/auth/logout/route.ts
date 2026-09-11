import { NextResponse } from 'next/server';
import { destroySession, getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    db.prepare(
      `
      INSERT INTO audit_events (id, action, entity_type, entity_id, performed_by, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      crypto.randomUUID(),
      'USER_LOGOUT',
      'USER',
      user.id,
      user.id,
      JSON.stringify({ email: user.email }),
      new Date().toISOString(),
    );
  }

  await destroySession();
  return NextResponse.json({ status: 'success' });
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  );
}
