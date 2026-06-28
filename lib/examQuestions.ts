import { getAllExamQuestions } from './db';
import { lookupWrongRate } from './examWrongRates';

export interface ExamQuestion {
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

export interface ExamRound {
  year: number;
  month: number | null;
  examName: string;
  questionCount: number;
  hasWrongRate: boolean;
}

let cache: ExamQuestion[] | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadAll(): Promise<ExamQuestion[]> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;

  const rows = await getAllExamQuestions();
  cache = rows.map((q) => ({
    id: q.id,
    year: q.year,
    month: q.month,
    examName: q.exam_name,
    number: q.number,
    stem: q.stem,
    choices: JSON.parse(q.choices_json),
    answer: q.answer,
    explanation: q.explanation,
    wrongRate: lookupWrongRate(q.year, q.month, q.number),
  }));
  cacheLoadedAt = now;
  return cache;
}

export async function getExamRounds(): Promise<ExamRound[]> {
  const all = await loadAll();
  const map = new Map<string, ExamRound>();

  for (const q of all) {
    const key = `${q.year}-${q.month ?? 'csat'}`;
    const existing = map.get(key);
    if (existing) {
      existing.questionCount++;
      if (q.wrongRate !== null) existing.hasWrongRate = true;
    } else {
      map.set(key, {
        year: q.year,
        month: q.month,
        examName: q.examName,
        questionCount: 1,
        hasWrongRate: q.wrongRate !== null,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return (b.month ?? 99) - (a.month ?? 99);
  });
}

export async function getQuestionsForRound(
  year: number,
  month: number | null,
  mode: 'top5' | 'all'
): Promise<ExamQuestion[]> {
  const all = (await loadAll()).filter((q) => q.year === year && q.month === month);
  const sortedByNumber = [...all].sort((a, b) => a.number - b.number);

  if (mode === 'all') return sortedByNumber;

  const withRate = sortedByNumber.filter((q) => q.wrongRate !== null);
  if (withRate.length > 0) {
    return [...withRate].sort((a, b) => (b.wrongRate ?? 0) - (a.wrongRate ?? 0)).slice(0, 5);
  }
  // 오답률 데이터가 없으면 임시로 앞 5문제를 보여준다.
  return sortedByNumber.slice(0, 5);
}
