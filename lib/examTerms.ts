import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const XLSX_PATH = path.join(process.cwd(), 'data', 'exam_terms.xlsx');
const JSON_PATH = path.join(process.cwd(), 'data', 'exam_terms.json');

export interface ExamTermInfo {
  term: string;
  recentExamInfo: string;
}

let cache: Map<string, ExamTermInfo> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function loadFromJson(): Map<string, ExamTermInfo> {
  const map = new Map<string, ExamTermInfo>();
  if (!fs.existsSync(JSON_PATH)) return map;
  try {
    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (row.term) {
          map.set(String(row.term).trim(), {
            term: String(row.term).trim(),
            recentExamInfo: String(row.recentExamInfo ?? row.info ?? ''),
          });
        }
      }
    }
  } catch (err) {
    console.error('exam_terms.json 파싱 실패:', err);
  }
  return map;
}

function loadFromXlsx(): Map<string, ExamTermInfo> {
  const map = new Map<string, ExamTermInfo>();
  if (!fs.existsSync(XLSX_PATH)) return map;
  try {
    const stat = fs.statSync(XLSX_PATH);
    if (stat.size === 0) return map;

    const workbook = XLSX.readFile(XLSX_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return map;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    for (const row of rows) {
      const term = String(row['용어'] ?? row['term'] ?? '').trim();
      if (!term) continue;
      const info = String(
        row['최근5개년기출연계'] ?? row['recentExamInfo'] ?? row['기출정보'] ?? ''
      ).trim();
      map.set(term, { term, recentExamInfo: info });
    }
  } catch (err) {
    console.error('exam_terms.xlsx 읽기 실패:', err);
  }
  return map;
}

export function getExamTermsMap(): Map<string, ExamTermInfo> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;

  const fromXlsx = loadFromXlsx();
  const merged = fromXlsx.size > 0 ? fromXlsx : loadFromJson();

  cache = merged;
  cacheLoadedAt = now;
  return merged;
}

export function lookupExamTerm(term: string): ExamTermInfo | null {
  const map = getExamTermsMap();
  return map.get(term) ?? null;
}
