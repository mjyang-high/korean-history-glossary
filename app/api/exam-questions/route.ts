import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';
import { getQuestionsForRound } from '@/lib/examQuestions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidAuthToken(token))) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year'));
  const monthParam = searchParams.get('month');
  const month = monthParam === 'csat' || monthParam === '' || monthParam === null ? null : Number(monthParam);
  const mode = searchParams.get('mode') === 'all' ? 'all' : 'top5';

  if (!year) {
    return NextResponse.json({ error: '연도가 필요합니다.' }, { status: 400 });
  }

  const questions = await getQuestionsForRound(year, month, mode);
  return NextResponse.json({ questions });
}
