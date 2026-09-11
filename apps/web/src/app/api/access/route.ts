import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, accessHash, validAccessToken } from '@/lib/auth/private-access';
import { isSameOrigin } from '@/lib/auth/origin';
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: 'طلب غير مسموح' }, { status: 403 });
  try {
    const body = await req.json();
    const hash = await accessHash();
    if (!hash || typeof body.token !== 'string' || !validAccessToken(body.token, hash))
      return NextResponse.json({ message: 'رابط الوصول غير صالح' }, { status: 404 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE, body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'تعذر التحقق من الرابط' }, { status: 400 });
  }
}
