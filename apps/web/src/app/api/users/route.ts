import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db';
export async function GET() {
  const auth = await authorize('audit:read');
  if (auth.response) return auth.response;
  return NextResponse.json({
    data: db
      .prepare('SELECT id,name,email,role,contractor_id FROM users ORDER BY created_at DESC')
      .all(),
  });
}
