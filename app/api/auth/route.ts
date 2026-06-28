import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, expectedAuthToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!process.env.CLASS_PASSWORD) {
    return NextResponse.json({ error: '서버에 비밀번호가 설정되지 않았습니다.' }, { status: 500 });
  }

  if (password !== process.env.CLASS_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, await expectedAuthToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
