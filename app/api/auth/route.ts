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
  // maxAge를 주지 않으면 세션 쿠키가 되어 브라우저(창)를 완전히 닫으면 사라진다.
  // 같은 기기라도 창을 닫고 다시 열면 비밀번호를 다시 입력하게 하기 위함.
  res.cookies.set(AUTH_COOKIE_NAME, await expectedAuthToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return res;
}
