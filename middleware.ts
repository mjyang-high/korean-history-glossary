import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidAuthToken(token))) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/search', '/api/top-terms', '/api/exam-rounds', '/api/exam-questions', '/api/exam-question-image'],
};
