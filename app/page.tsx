'use client';

import { useEffect, useState } from 'react';

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
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중...</div>;
  }

  if (!authed) {
    return (
      <main className="flex h-screen items-center justify-center bg-gray-50">
        <form
          onSubmit={handleLogin}
          className="w-80 rounded-2xl bg-white p-8 shadow-md flex flex-col gap-4"
        >
          <h1 className="text-lg font-bold text-gray-800">한국사 용어 도우미</h1>
          <p className="text-sm text-gray-500">반 비밀번호를 입력하면 검색할 수 있어요.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-400"
          />
          {authError && <p className="text-sm text-red-500">{authError}</p>}
          <button
            type="submit"
            className="rounded-lg bg-blue-500 py-2 font-medium text-white hover:bg-blue-600"
          >
            입장하기
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-gray-800">한국사 용어 도우미</h1>
      <p className="mb-6 text-sm text-gray-500">
        교과서에 나온 단어 중 모르는 게 있으면 검색해보세요. 내각, 관제, 공화정, 결사 같은 단어도 좋아요.
      </p>

      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="예: 공화정"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {results.length === 0 && (
            <p className="text-sm text-gray-400">검색 결과가 여기에 카드로 표시돼요.</p>
          )}

          {results.map((r) => (
            <ResultCard key={r.term} result={r} />
          ))}
        </div>

        <aside className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-gray-700">학생들이 많이 검색한 단어 TOP 10</h2>
          {topTerms.length === 0 ? (
            <p className="text-sm text-gray-400">아직 검색 기록이 없어요.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {topTerms.map((t, idx) => (
                <li key={t.term} className="flex justify-between text-sm text-gray-600">
                  <span>
                    {idx + 1}. {t.term}
                  </span>
                  <span className="text-gray-400">{t.count}회</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  if (result.notFound) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-800">{result.term}</h3>
        <p className="mt-2 text-sm text-gray-500">교과서에서 이 단어를 찾지 못했어요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">{result.term}</h3>
        {result.cached && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            저장된 설명
          </span>
        )}
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
        {result.explanation}
      </p>

      {result.examInfo && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          📌 최근 5개년 수능 기출 연계: {result.examInfo.recentExamInfo}
        </div>
      )}

      {result.contexts && result.contexts.length > 0 && (
        <details className="mt-3 text-sm text-gray-500">
          <summary className="cursor-pointer text-blue-500">교과서 원문 보기</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {result.contexts.map((c, idx) => (
              <li key={idx} className="rounded-lg bg-gray-50 p-2">
                <span className="font-medium text-gray-600">
                  {c.book} {c.pageNo}쪽{c.unit ? ` · ${c.unit}` : ''}
                </span>
                <p className="mt-1 text-gray-500">...{c.snippet}...</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
