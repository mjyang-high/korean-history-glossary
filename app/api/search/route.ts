import { NextRequest, NextResponse } from 'next/server';
import {
  findPagesContaining,
  getCachedTerm,
  setCachedTerm,
  incrementSearchCount,
} from '@/lib/db';
import { buildContexts, ContextSnippet } from '@/lib/search';
import { explainTerm } from '@/lib/claude';
import { lookupExamTerm } from '@/lib/examTerms';
import { AUTH_COOKIE_NAME, isValidAuthToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const authToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!(await isValidAuthToken(authToken))) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const term = typeof body?.term === 'string' ? body.term.trim() : '';

  if (!term) {
    return NextResponse.json({ error: '검색할 단어를 입력해주세요.' }, { status: 400 });
  }
  if (term.length > 30) {
    return NextResponse.json({ error: '단어가 너무 길어요.' }, { status: 400 });
  }

  await incrementSearchCount(term);

  const [cached, examInfo] = await Promise.all([getCachedTerm(term), lookupExamTerm(term)]);

  if (cached) {
    return NextResponse.json({
      term,
      explanation: cached.explanation,
      contexts: JSON.parse(cached.contexts_json) as ContextSnippet[],
      examInfo,
      cached: true,
    });
  }

  const pages = await findPagesContaining(term);
  if (pages.length === 0) {
    return NextResponse.json({
      term,
      notFound: true,
      examInfo,
    });
  }

  const contexts = buildContexts(pages, term);

  let explanation: string;
  try {
    explanation = await explainTerm(term, contexts, examInfo);
  } catch (err) {
    console.error('Claude 호출 실패:', err);
    return NextResponse.json(
      { error: '설명을 생성하는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 502 }
    );
  }

  await setCachedTerm(term, explanation, JSON.stringify(contexts));

  return NextResponse.json({
    term,
    explanation,
    contexts,
    examInfo,
    cached: false,
  });
}
