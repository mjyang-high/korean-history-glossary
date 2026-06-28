import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';
import { getExamRounds } from '@/lib/examQuestions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidAuthToken(token))) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  return NextResponse.json({ rounds: await getExamRounds() });
}
