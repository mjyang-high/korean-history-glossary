import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const XLSX_PATH = path.join(process.cwd(), 'data', 'exam_wrong_rates.xlsx');
const JSON_PATH = path.join(process.cwd(), 'data', 'exam_wrong_rates.json');

// key: "year-month-number" (수능처럼 월이 없으면 "year-csat-number")
let cache: Map<string, number> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function makeKey(year: number, month: number | null, number: number): string {
  return `${year}-${month ?? 'csat'}-${number}`;
}

function loadFromJson(): Map<string, number> {
  const map = new Map<string, number>();
  if (!fs.existsSync(JSON_PATH)) return map;
  try {
    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    if (Array.isArray(raw)) {
      for (const row of raw) {
        const year = Number(row.year);
        const month = row.month === null || row.month === undefined || row.month === '' ? null : Number(row.month);
        const number = Number(row.number);
        const wrongRate = Number(row.wrongRate);
        if (year && number && !Number.isNaN(wrongRate)) {
          map.set(makeKey(year, month, number), wrongRate);
        }
      }
    }
  } catch (err) {
    console.error('exam_wrong_rates.json 파싱 실패:', err);
  }
  return map;
}

function loadFromXlsx(): Map<string, number> {
  const map = new Map<string, number>();
  if (!fs.existsSync(XLSX_PATH)) return map;
  try {
    const stat = fs.statSync(XLSX_PATH);
    if (stat.size === 0) return map;

    const workbook = XLSX.readFile(XLSX_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return map;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    for (const row of rows) {
      const year = Number(row['연도'] ?? row['year']);
      const monthRaw = row['월'] ?? row['month'];
      const month = monthRaw === undefined || monthRaw === '' || monthRaw === null ? null : Number(monthRaw);
      const number = Number(row['문항번호'] ?? row['number']);
      const wrongRate = Number(row['오답률'] ?? row['wrongRate']);
      if (year && number && !Number.isNaN(wrongRate)) {
        map.set(makeKey(year, month, number), wrongRate);
      }
    }
  } catch (err) {
    console.error('exam_wrong_rates.xlsx 읽기 실패:', err);
  }
  return map;
}

export function getWrongRateMap(): Map<string, number> {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;

  const fromXlsx = loadFromXlsx();
  const merged = fromXlsx.size > 0 ? fromXlsx : loadFromJson();

  cache = merged;
  cacheLoadedAt = now;
  return merged;
}

export function lookupWrongRate(year: number, month: number | null, number: number): number | null {
  const map = getWrongRateMap();
  return map.get(makeKey(year, month, number)) ?? null;
}
