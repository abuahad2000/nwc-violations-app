import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
export async function GET() {
  const auth = await authorize('audit:read');
  if (auth.response) return auth.response;
  return NextResponse.json({
    data: await db
      .prepare('SELECT id,name,email,role,contractor_id FROM users ORDER BY created_at DESC')
      .all(),
  });
}
