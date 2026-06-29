import { neon } from '@neondatabase/serverless';

type SqlFn = ReturnType<typeof neon>;
let _sql: SqlFn | null = null;

function getSql(): SqlFn {
  if (!_sql) {
    const connectionString =
      process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL(또는 POSTGRES_URL)이 설정되지 않았습니다. Vercel Postgres(Neon) 연결 문자열을 .env.local에 넣어주세요.'
      );
    }
    _sql = neon(connectionString);
  }
  return _sql;
}

function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getSql()(strings, ...values);
}

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      book TEXT NOT NULL,
      page_no INTEGER NOT NULL,
      unit TEXT,
      content TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pages_book_page ON pages(book, page_no)`;

  await sql`
    CREATE TABLE IF NOT EXISTS term_cache (
      term TEXT PRIMARY KEY,
      explanation TEXT NOT NULL,
      contexts_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS search_counts (
      term TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      last_searched_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS exam_questions (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER,
      exam_name TEXT NOT NULL,
      number INTEGER NOT NULL,
      stem TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      answer INTEGER,
      explanation TEXT NOT NULL,
      page_no INTEGER
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_exam_questions_round ON exam_questions(year, month)`;
  await sql`ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS page_no INTEGER`;

  await sql`
    CREATE TABLE IF NOT EXISTS exam_pages (
      id TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER,
      page_no INTEGER NOT NULL,
      image_base64 TEXT NOT NULL
    )
  `;

  initialized = true;
}

export async function clearPages() {
  await ensureSchema();
  await sql`DELETE FROM pages`;
}

export async function insertPage(book: string, pageNo: number, unit: string | null, content: string) {
  await ensureSchema();
  await sql`INSERT INTO pages (book, page_no, unit, content) VALUES (${book}, ${pageNo}, ${unit}, ${content})`;
}

export interface PageRow {
  id: number;
  book: string;
  page_no: number;
  unit: string | null;
  content: string;
}

export async function findPagesContaining(term: string): Promise<PageRow[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT * FROM pages WHERE content ILIKE ${'%' + term + '%'} ORDER BY book, page_no
  `;
  return rows as unknown as PageRow[];
}

export interface TermCacheRow {
  term: string;
  explanation: string;
  contexts_json: string;
  created_at: string;
}

export async function getCachedTerm(term: string): Promise<TermCacheRow | undefined> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM term_cache WHERE term = ${term}`;
  return (rows as unknown as TermCacheRow[])[0];
}

export async function setCachedTerm(term: string, explanation: string, contextsJson: string) {
  await ensureSchema();
  await sql`
    INSERT INTO term_cache (term, explanation, contexts_json, created_at)
    VALUES (${term}, ${explanation}, ${contextsJson}, now())
    ON CONFLICT (term) DO UPDATE SET
      explanation = EXCLUDED.explanation,
      contexts_json = EXCLUDED.contexts_json,
      created_at = EXCLUDED.created_at
  `;
}

export async function incrementSearchCount(term: string) {
  await ensureSchema();
  await sql`
    INSERT INTO search_counts (term, count, last_searched_at)
    VALUES (${term}, 1, now())
    ON CONFLICT (term) DO UPDATE SET
      count = search_counts.count + 1,
      last_searched_at = now()
  `;
}

export interface SearchCountRow {
  term: string;
  count: number;
}

export async function getTopTerms(limit = 10): Promise<SearchCountRow[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT term, count FROM search_counts ORDER BY count DESC, term ASC LIMIT ${limit}
  `;
  return rows as unknown as SearchCountRow[];
}

export interface ExamQuestionRow {
  id: string;
  year: number;
  month: number | null;
  exam_name: string;
  number: number;
  stem: string;
  choices_json: string;
  answer: number | null;
  explanation: string;
  page_no: number | null;
}

export async function clearExamQuestions() {
  await ensureSchema();
  await sql`DELETE FROM exam_questions`;
}

export async function insertExamQuestion(q: {
  id: string;
  year: number;
  month: number | null;
  examName: string;
  number: number;
  stem: string;
  choices: string[];
  answer: number | null;
  explanation: string;
  pageNo: number | null;
}) {
  await ensureSchema();
  await sql`
    INSERT INTO exam_questions (id, year, month, exam_name, number, stem, choices_json, answer, explanation, page_no)
    VALUES (${q.id}, ${q.year}, ${q.month}, ${q.examName}, ${q.number}, ${q.stem}, ${JSON.stringify(q.choices)}, ${q.answer}, ${q.explanation}, ${q.pageNo})
    ON CONFLICT (id) DO UPDATE SET
      year = EXCLUDED.year,
      month = EXCLUDED.month,
      exam_name = EXCLUDED.exam_name,
      number = EXCLUDED.number,
      stem = EXCLUDED.stem,
      choices_json = EXCLUDED.choices_json,
      answer = EXCLUDED.answer,
      explanation = EXCLUDED.explanation,
      page_no = EXCLUDED.page_no
  `;
}

export async function getAllExamQuestions(): Promise<ExamQuestionRow[]> {
  await ensureSchema();
  const rows = await sql`SELECT * FROM exam_questions ORDER BY year DESC, month DESC, number ASC`;
  return rows as unknown as ExamQuestionRow[];
}

export async function clearExamPages() {
  await ensureSchema();
  await sql`DELETE FROM exam_pages`;
}

export async function insertExamPage(id: string, year: number, month: number | null, pageNo: number, imageBase64: string) {
  await ensureSchema();
  await sql`
    INSERT INTO exam_pages (id, year, month, page_no, image_base64)
    VALUES (${id}, ${year}, ${month}, ${pageNo}, ${imageBase64})
    ON CONFLICT (id) DO UPDATE SET
      year = EXCLUDED.year,
      month = EXCLUDED.month,
      page_no = EXCLUDED.page_no,
      image_base64 = EXCLUDED.image_base64
  `;
}

export async function getExamPageImage(year: number, month: number | null, pageNo: number): Promise<string | null> {
  await ensureSchema();
  const id = `${year}-${month ?? 'csat'}-${pageNo}`;
  const rows = await sql`SELECT image_base64 FROM exam_pages WHERE id = ${id}`;
  const row = (rows as unknown as { image_base64: string }[])[0];
  return row ? row.image_base64 : null;
}
