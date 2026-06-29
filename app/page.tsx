'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FrameCard } from '@/components/FrameCard';
import { HistoryMotifRow } from '@/components/HistoryMotifs';
import { SiteFooter } from '@/components/SiteFooter';

interface ContextSnippet {
  book: string;
  pageNo: number;
  unit: string | null;
  snippet: string;
}

interface ExamInfo {
  term: string;
  recentExamInfo: string;
}

interface SearchResult {
  term: string;
  explanation?: string;
  contexts?: ContextSnippet[];
  examInfo?: ExamInfo | null;
  cached?: boolean;
  notFound?: boolean;
}

interface TopTerm {
  term: string;
  count: number;
}

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [topTerms, setTopTerms] = useState<TopTerm[]>([]);

  useEffect(() => {
    fetch('/api/check-auth')
      .then((res) => res.json())
      .then((data) => setAuthed(Boolean(data.ok)))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) refreshTopTerms();
  }, [authed]);

  async function refreshTopTerms() {
    try {
      const res = await fetch('/api/top-terms');
      const data = await res.json();
      setTopTerms(data.topTerms ?? []);
    } catch {
      // 순위 갱신 실패는 조용히 무시
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setAuthError(data.error ?? '로그인에 실패했어요.');
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '검색 중 오류가 발생했어요.');
      } else {
        setResults((prev) => [data, ...prev.filter((r) => r.term !== data.term)]);
        refreshTopTerms();
      }
    } catch {
      setError('서버에 연결할 수 없어요.');
    } finally {
      setLoading(false);
      setTerm('');
    }
  }

  if (authed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4efe3] text-[#1c1a16]/40 font-display">
        로딩 중...
      </div>
    );
  }

  if (!authed) {
    return (
      <main className="relative flex h-screen items-center justify-center bg-[#f4efe3] px-4">
        <FrameCard className="w-full max-w-sm p-8">
          <span className="mx-auto mb-6 block w-fit rounded-sm border border-[#1c1a16]/60 px-3 py-1 text-[11px] tracking-wide text-[#1c1a16]/60">
            대진고 학생 전용
          </span>
          <h1 className="font-display text-center text-3xl font-black leading-tight">
            한국사<br />학습 도우미
          </h1>
          <p className="mt-3 text-center text-sm text-[#1c1a16]/60">
            학교번호를 입력하면 검색할 수 있어요.
          </p>
          <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="학교번호"
              className="rounded-xl border-2 border-[#1c1a16]/30 bg-white px-4 py-2.5 outline-none focus:border-[#c1392d]"
            />
            {authError && <p className="text-sm text-[#c1392d]">{authError}</p>}
            <button
              type="submit"
              className="rounded-xl bg-[#c1392d] py-2.5 font-display font-bold text-white transition hover:bg-[#a52f25]"
            >
              입장하기
            </button>
          </form>
        </FrameCard>
        <div className="absolute bottom-0 left-0 right-0">
          <SiteFooter />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <FrameCard className="mb-8 px-6 py-7 sm:px-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="mb-3 inline-flex flex-col items-center rounded-sm border border-[#1c1a16]/60 px-3 py-1 text-[11px] leading-tight tracking-wide text-[#1c1a16]/60">
              <span>교과서 내</span>
              <span className="text-[10px] text-[#1c1a16]/40">학습 도우미</span>
            </span>
            <h1 className="font-display text-3xl font-black leading-none sm:text-5xl">
              한국사<span className="ml-2 text-[#c1392d]">·</span>
              <span className="text-[#1f7a7a]">학습</span> 도우미
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[#1c1a16]/65">
              교과서에 나온 단어 중 모르는 게 있으면 검색해보세요. 내각, 관제, 공화정, 결사 같은 단어도 좋아요.
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-3 sm:flex">
            <HistoryMotifRow />
          </div>
        </div>

        <div className="mt-5 h-1.5 w-full rounded-full bg-gradient-to-r from-[#c1392d] via-[#1c1a16]/15 to-[#1f7a7a]" />

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="예: 공화정"
            className="flex-1 rounded-xl border-2 border-[#1c1a16]/30 bg-white px-4 py-3 outline-none focus:border-[#1f7a7a]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#1f7a7a] px-6 py-3 font-display font-bold text-white transition hover:bg-[#176161] disabled:opacity-50"
          >
            {loading ? '검색 중...' : '검색'}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-[#c1392d]">{error}</p>}
      </FrameCard>

      <Link href="/quiz">
        <FrameCard className="mb-8 flex items-center justify-between gap-4 px-6 py-6 transition hover:bg-[#f4efe3] sm:px-10">
          <div>
            <span className="mb-2 inline-block rounded-sm border border-[#1c1a16]/60 px-3 py-1 text-[11px] tracking-wide text-[#1c1a16]/60">
              모의고사 대비
            </span>
            <h2 className="font-display text-2xl font-black">기출문제 풀어보기</h2>
            <p className="mt-1 text-sm text-[#1c1a16]/65">
              모의고사 전날, 오답률 TOP5 또는 전체 20문제를 카드 한 장씩 풀고 바로 채점·해설까지!
            </p>
          </div>
          <span className="font-display shrink-0 rounded-xl bg-[#1c1a16] px-5 py-3 font-bold text-white">
            시작하기 →
          </span>
        </FrameCard>
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-5">
          {results.length === 0 && (
            <p className="px-2 text-sm text-[#1c1a16]/40">검색 결과가 여기에 카드로 표시돼요.</p>
          )}

          {results.map((r) => (
            <ResultCard key={r.term} result={r} />
          ))}
        </div>

        <FrameCard className="p-5">
          <h2 className="font-display mb-3 font-bold text-[#1c1a16]">
            학생들이 많이 검색한 단어 <span className="text-[#c1392d]">TOP 10</span>
          </h2>
          {topTerms.length === 0 ? (
            <p className="text-sm text-[#1c1a16]/40">아직 검색 기록이 없어요.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {topTerms.map((t, idx) => (
                <li key={t.term} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold text-[#c1392d]">{idx + 1}</span>
                    <span className="text-[#1c1a16]/80">{t.term}</span>
                  </span>
                  <span className="text-[#1c1a16]/40">{t.count}회</span>
                </li>
              ))}
            </ol>
          )}
        </FrameCard>
      </div>
      <SiteFooter />
    </main>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  if (result.notFound) {
    return (
      <FrameCard className="p-5">
        <h3 className="font-display font-bold text-[#1c1a16]">{result.term}</h3>
        <p className="mt-2 text-sm text-[#1c1a16]/50">교과서에서 이 단어를 찾지 못했어요.</p>
      </FrameCard>
    );
  }

  return (
    <FrameCard className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-black text-[#1c1a16]">{result.term}</h3>
        {result.cached && (
          <span className="rounded-full border border-[#1c1a16]/20 px-2 py-0.5 text-xs text-[#1c1a16]/50">
            저장된 설명
          </span>
        )}
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-[#1c1a16]/85">
        {result.explanation}
      </p>

      {result.examInfo && (
        <div className="mt-3 rounded-lg border border-[#c1392d]/30 bg-[#c1392d]/[0.06] p-3 text-sm text-[#8c2a21]">
          📌 최근 5개년 수능 기출 연계: {result.examInfo.recentExamInfo}
        </div>
      )}

      {result.contexts && result.contexts.length > 0 && (
        <details className="mt-3 text-sm text-[#1c1a16]/60">
          <summary className="cursor-pointer font-medium text-[#1f7a7a]">교과서 원문 보기</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {result.contexts.map((c, idx) => (
              <li key={idx} className="rounded-lg border border-[#1c1a16]/10 bg-white p-2.5">
                <span className="font-medium text-[#1c1a16]/70">
                  {c.book} {c.pageNo}쪽{c.unit ? ` · ${c.unit}` : ''}
                </span>
                <p className="mt-1 text-[#1c1a16]/55">...{c.snippet}...</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </FrameCard>
  );
}
