import { NextResponse, type NextRequest } from 'next/server';

const buckets = new Map<string, { start: number; count: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = forwarded || request.headers.get('x-real-ip') || 'local-client';
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) buckets.set(key, { start: now, count: 1 });
  else {
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) return NextResponse.json({ message: 'تم تجاوز عدد الطلبات المسموح مؤقتًا' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export const config = { matcher: ['/api/:path*'] };
