'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FrameCard } from '@/components/FrameCard';
import { SchoolBadge } from '@/components/SchoolBadge';

interface ExamRound {
  year: number;
  month: number | null;
  examName: string;
  questionCount: number;
  hasWrongRate: boolean;
}

interface ExamQuestion {
  id: string;
  year: number;
  month: number | null;
  examName: string;
  number: number;
  stem: string;
  choices: string[];
  answer: number | null;
  explanation: string;
  wrongRate: number | null;
}

type Mode = 'top5' | 'all';

export default function QuizPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rounds, setRounds] = useState<ExamRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<ExamRound | null>(null);
  const [mode, setMode] = useState<Mode>('top5');

  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    fetch('/api/check-auth')
      .then((res) => res.json())
      .then((data) => setAuthed(Boolean(data.ok)))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch('/api/exam-rounds')
      .then((res) => res.json())
      .then((data) => setRounds(data.rounds ?? []));
  }, [authed]);

  async function startQuiz() {
    if (!selectedRound) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedRound.year),
        month: selectedRound.month === null ? 'csat' : String(selectedRound.month),
        mode,
      });
      const res = await fetch(`/api/exam-questions?${params.toString()}`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setIndex(0);
      setSelected(null);
      setCorrectCount(0);
    } finally {
      setLoading(false);
    }
  }

  function pickChoice(choiceNumber: number) {
    if (selected !== null) return;
    setSelected(choiceNumber);
    const current = questions?.[index];
    if (current && choiceNumber === current.answer) {
      setCorrectCount((c) => c + 1);
    }
  }

  function nextQuestion() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  function resetToStart() {
    setQuestions(null);
    setSelectedRound(null);
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
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
      <main className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f4efe3] px-4 text-center">
        <p className="text-[#1c1a16]/70">먼저 메인 페이지에서 비밀번호를 입력해주세요.</p>
        <Link href="/" className="font-display rounded-xl bg-[#1c1a16] px-5 py-2.5 font-bold text-white">
          메인으로 가기
        </Link>
      </main>
    );
  }

  // 퀴즈 진행 화면
  if (questions && questions.length > 0) {
    if (index >= questions.length) {
      return (
        <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20">
          <FrameCard className="w-full p-8 text-center">
            <span className="mb-3 inline-block rounded-sm border border-[#1c1a16]/60 px-3 py-1 text-[11px] tracking-wide text-[#1c1a16]/60">
              결과
            </span>
            <h1 className="font-display text-3xl font-black">
              {correctCount} / {questions.length} 문제 정답!
            </h1>
            <p className="mt-2 text-sm text-[#1c1a16]/60">{selectedRound?.examName}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={resetToStart}
                className="font-display rounded-xl bg-[#1c1a16] px-5 py-2.5 font-bold text-white"
              >
                다른 회차 풀기
              </button>
              <Link
                href="/"
                className="font-display flex items-center rounded-xl border-2 border-[#1c1a16]/30 px-5 py-2.5 font-bold text-[#1c1a16]"
              >
                메인으로
              </Link>
            </div>
          </FrameCard>
        </main>
      );
    }

    const q = questions[index];
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between text-sm text-[#1c1a16]/50">
          <span>
            {selectedRound?.examName} · {index + 1} / {questions.length}
          </span>
          <span>{correctCount}개 정답</span>
        </div>

        <FrameCard className="p-6 sm:p-8">
          <p className="font-display text-lg font-bold leading-relaxed">
            {q.number}. {q.stem}
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            {q.choices.map((choice, i) => {
              const choiceNumber = i + 1;
              const isAnswer = choiceNumber === q.answer;
              const isSelected = choiceNumber === selected;
              let style = 'border-[#1c1a16]/20 bg-white';
              if (selected !== null) {
                if (isAnswer) style = 'border-[#1f7a7a] bg-[#1f7a7a]/10';
                else if (isSelected) style = 'border-[#c1392d] bg-[#c1392d]/10';
              }
              return (
                <button
                  key={choiceNumber}
                  onClick={() => pickChoice(choiceNumber)}
                  disabled={selected !== null}
                  className={`rounded-xl border-2 px-4 py-3 text-left text-sm transition ${style}`}
                >
                  {choiceNumber}. {choice}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-5">
              <p
                className={`font-display mb-2 font-bold ${
                  selected === q.answer ? 'text-[#1f7a7a]' : 'text-[#c1392d]'
                }`}
              >
                {selected === q.answer ? '정답이에요!' : `오답이에요. 정답은 ${q.answer}번이에요.`}
              </p>
              <div className="rounded-lg border border-[#1c1a16]/10 bg-white p-3 text-sm leading-relaxed text-[#1c1a16]/80">
                {q.explanation}
              </div>
              <button
                onClick={nextQuestion}
                className="font-display mt-4 w-full rounded-xl bg-[#1c1a16] py-3 font-bold text-white"
              >
                다음 문제 →
              </button>
            </div>
          )}
        </FrameCard>
      </main>
    );
  }

  // 회차/모드 선택 화면
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <FrameCard className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <span className="mb-3 inline-flex flex-col items-center rounded-sm border border-[#1c1a16]/60 px-3 py-1 text-[11px] leading-tight tracking-wide text-[#1c1a16]/60">
            <span>모의고사 대비</span>
            <span className="text-[10px] text-[#1c1a16]/40">기출문제</span>
          </span>
          <SchoolBadge />
        </div>
        <h1 className="font-display text-3xl font-black">
          기출문제 <span className="text-[#c1392d]">풀어보기</span>
        </h1>
        <p className="mt-2 text-sm text-[#1c1a16]/65">회차를 고르고, 오답률 TOP5 또는 전체 20문제 중 선택하세요.</p>
        <div className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-[#c1392d] via-[#1c1a16]/15 to-[#1f7a7a]" />

        <div className="mt-6">
          <p className="font-display mb-2 text-sm font-bold">회차 선택</p>
          <div className="flex flex-col gap-2">
            {rounds.length === 0 && <p className="text-sm text-[#1c1a16]/40">불러오는 중...</p>}
            {rounds.map((r) => {
              const key = `${r.year}-${r.month ?? 'csat'}`;
              const isSelected =
                selectedRound &&
                selectedRound.year === r.year &&
                selectedRound.month === r.month;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedRound(r)}
                  className={`rounded-xl border-2 px-4 py-3 text-left text-sm transition ${
                    isSelected ? 'border-[#1f7a7a] bg-[#1f7a7a]/10' : 'border-[#1c1a16]/15 bg-white'
                  }`}
                >
                  <span className="font-medium">{r.examName}</span>
                  <span className="ml-2 text-[#1c1a16]/40">
                    ({r.questionCount}문제{r.hasWrongRate ? ' · 오답률 있음' : ''})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedRound && (
          <div className="mt-6">
            <p className="font-display mb-2 text-sm font-bold">문제 수</p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('top5')}
                className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'top5' ? 'border-[#c1392d] bg-[#c1392d]/10' : 'border-[#1c1a16]/15 bg-white'
                }`}
              >
                오답률 TOP5
              </button>
              <button
                onClick={() => setMode('all')}
                className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'all' ? 'border-[#c1392d] bg-[#c1392d]/10' : 'border-[#1c1a16]/15 bg-white'
                }`}
              >
                전체 20문제
              </button>
            </div>
          </div>
        )}

        <button
          onClick={startQuiz}
          disabled={!selectedRound || loading}
          className="font-display mt-7 w-full rounded-xl bg-[#1c1a16] py-3 font-bold text-white disabled:opacity-40"
        >
          {loading ? '불러오는 중...' : '시작하기'}
        </button>

        <Link href="/" className="mt-4 block text-center text-sm text-[#1c1a16]/40 underline">
          메인으로 돌아가기
        </Link>
      </FrameCard>
    </main>
  );
}
