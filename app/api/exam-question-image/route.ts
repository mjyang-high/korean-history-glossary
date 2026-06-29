import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';
import { getExamQuestionImage } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidAuthToken(token))) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '문항 id가 필요합니다.' }, { status: 400 });
  }

  const base64 = await getExamQuestionImage(id);
  if (!base64) {
    return NextResponse.json({ error: '이미지를 찾을 수 없어요.' }, { status: 404 });
  }

  const buffer = Buffer.from(base64, 'base64');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
