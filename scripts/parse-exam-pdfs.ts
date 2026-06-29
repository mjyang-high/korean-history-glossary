// 사용법: data/exam-pdf/ 폴더에 EBSi 학력평가 문제지(mun)/해설지(hsj) PDF를 넣고 실행
// npx tsx scripts/parse-exam-pdfs.ts
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const DIR = path.join(process.cwd(), 'data', 'exam-pdf');
const CMAP_URL = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps') + path.sep;
const OUT_PATH = path.join(process.cwd(), 'data', 'exam_questions.json');

const CIRCLES = ['①', '②', '③', '④', '⑤'];

// 같은 회차의 중복/다른 유형(홀수형 등) 문제지 - 선택지 순서가 달라 정답 번호가 틀릴 위험이 있어 제외
// (A515UN97은 과거에 2024-9 중복으로 의심해 제외했었지만, 실제로는 표지 회차 인식 버그로
// 다른 회차(2025-9)와 혼동된 것이었음이 확인되어 더 이상 제외하지 않는다.)
const SKIP_MUN_FILES = new Set<string>([]);

// 3월/11월 학력평가 해설지는 표지에 "OOOO학년도 N월" 문구가 없어 자동 매칭이 안 된다.
// 문제지 Q1~Q2 내용과 해설지 [출제의도] 내용을 직접 대조해 확인한 수동 매칭.
const MANUAL_PAIRS: Record<string, string> = {
  'his_main_mun_RS41QA31.pdf': 'his_main_hsj_461Y98HN.pdf', // 2025-3
  'his_main_mun_3FQ8IZ5K.pdf': 'his_main_hsj_UL3M4515.pdf', // 2024-3
  'his_main_mun_QYF6P8L4.pdf': 'his_main_hsj_T4Y8ZC3T.pdf', // 2023-3
  'his_main_mun_TA2XTK3Y.pdf': 'his_main_hsj_Y27E8133.pdf', // 2026-3
};

// PDF 텍스트 항목에는 단어 사이 공백이 이미 별도 항목(" ")으로 들어있는 경우가 많아,
// 항목마다 공백을 강제로 끼워 넣으면 "( 가 )"처럼 부자연스럽게 띄어 써진다.
// 줄바꿈(hasEOL)은 대부분 양쪽 정렬로 인한 단어 중간 줄바꿈(공백 없음)이라 그대로 이어붙이고,
// 줄이 우측 여백까지 차지 않고 일찍 끝난 경우(문장/항목의 실제 끝)에만 공백을 넣는다.
function joinPageTextItems(items: any[]): string {
  // 페이지 전체에서 줄이 도달하는 가장 오른쪽 끝(본문의 실제 우측 여백)을 먼저 구해둔다.
  // 첫 줄(머리말 등 짧은 줄)부터 시작해 누적으로 계산하면 첫 줄 자체가 기준이 되어버려
  // "짧은 줄"을 못 걸러내는 문제가 생기므로, 전체를 한 번 훑어 미리 고정값으로 구한다.
  let maxLineEndX = 0;
  for (const item of items) {
    if (!item.str) continue;
    const endX = item.transform[4] + (item.width ?? 0);
    if (endX > maxLineEndX) maxLineEndX = endX;
  }

  let result = '';
  let prevEndX: number | null = null;

  for (const item of items) {
    const str: string = item.str ?? '';
    if (str !== '') {
      result += str;
      prevEndX = item.transform[4] + (item.width ?? 0);
    }
    // hasEOL은 빈 문자열의 별도 항목으로 오기도 하고, 줄의 마지막 실제 글자 항목에
    // 곧바로 표시되기도 한다 — 두 경우 모두 처리해야 한다.
    // 줄이 우측 끝까지 거의 다 찼으면 줄바꿈으로 인한 이어짐(공백 없음),
    // 짧게 끝났으면 문장/항목의 실제 끝(공백 필요)으로 본다.
    if (item.hasEOL) {
      const isFullLine = prevEndX !== null && maxLineEndX > 0 && prevEndX >= maxLineEndX * 0.92;
      if (!isFullLine && !result.endsWith(' ')) {
        result += ' ';
      }
    }
  }
  return result;
}

async function extractText(filePath: string): Promise<{ text: string; numPages: number }> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += ' ' + joinPageTextItems(tc.items as any[]);
  }
  return { text: text.replace(/\s+/g, ' ').trim(), numPages: doc.numPages };
}

// 문제지는 20문제가 페이지마다 균등하게(예: 4페이지 x 5문제) 배치된다고 가정해 페이지 번호를 추정한다.
function estimatePageNo(questionNumber: number, numPages: number, totalQuestions = 20): number {
  const perPage = Math.ceil(totalQuestions / numPages);
  return Math.min(numPages, Math.ceil(questionNumber / perPage));
}

// 일부 문제지는 문항 본문 안에 다른 회차의 "YYYY학년도 N월" 문구가 우연히 섞여 있어
// (예: 자료에 등장하는 연도가 마침 학력평가 표기와 같은 형태), 본문에서 처음 만나는
// "학년도" 문구를 그대로 믿으면 회차를 잘못 인식할 수 있다.
// 실제 표지에는 "OO교시 한국사 영역YYYY학년도 N월"처럼 "교시" 바로 뒤에 표기되므로,
// 그 패턴을 우선 찾고 없으면 첫 매칭으로 대체한다.
function extractYearMonth(text: string): { year: number | null; month: number | null; examName: string } {
  const coverMatch = text.match(/교시[^0-9]{0,15}(\d{4})\s*학년도\s*(?:(\d{1,2})\s*월\s*)?/);
  const m = coverMatch ?? text.match(/(\d{4})\s*학년도\s*(?:(\d{1,2})\s*월\s*)?/);
  if (!m) return { year: null, month: null, examName: '미확인 시험' };
  const year = parseInt(m[1], 10);
  const month = m[2] ? parseInt(m[2], 10) : null;
  const examName = month ? `${year}학년도 ${month}월 전국연합학력평가` : `${year}학년도 대학수학능력시험`;
  return { year, month, examName };
}

// "1. ... ① ... ② ... ③ ... ④ ... ⑤ ..." 형태를, 1~20번이 순서대로 등장하는 지점만 골라 분리한다.
//
// 일부 문항은 본문 안에 "1. 유적 명칭 2. 탐구 목적 3. 탐구 내용"처럼 자체적으로 번호가 매겨진
// 목록을 포함하는데, 이게 우연히 다음 문항 번호("2.", "3." 등)와 패턴이 같아 혼동될 수 있다.
// 그래서 후보 위치를 찾으면, 직전 문항 시작점부터 후보 위치까지의 구간에 선택지 동그라미
// (①~⑤)가 5개 이상 들어있는지 확인한다 — 진짜 문항이라면 그 구간에 직전 문항의 5개 선택지가
// 모두 들어있어야 하기 때문이다. 부족하면 본문 속 목록일 가능성이 높으므로 건너뛰고 더 뒤에서
// 같은 번호의 다음 후보를 찾는다.
function splitBySequentialNumber(text: string, markerAfterNumber: RegExp, maxN = 20) {
  const blocks: { n: number; start: number; end: number }[] = [];
  let prevStart = 0;
  let searchFrom = 0;

  for (let n = 1; n <= maxN; n++) {
    const re = new RegExp(`(?:^|[^0-9])(${n})\\s*\\.\\s*${markerAfterNumber.source}`, 'd');
    let cursor = searchFrom;
    let accepted: number | null = null;

    while (true) {
      const slice = text.slice(cursor);
      const match = slice.match(re) as (RegExpMatchArray & { indices?: Array<[number, number]> }) | null;
      if (!match || match.index === undefined) break;
      const groupStart = match.indices?.[1]?.[0];
      const candidate = cursor + (groupStart !== undefined ? groupStart : match.index + match[0].indexOf(String(n)));

      // n=1은 비교할 "직전 문항"이 없으니 첫 매칭을 그대로 받아들인다.
      if (n === 1) {
        accepted = candidate;
        break;
      }
      const span = text.slice(prevStart, candidate);
      const circleCount = (span.match(/[①②③④⑤]/g) ?? []).length;
      if (circleCount >= 5) {
        accepted = candidate;
        break;
      }
      // 선택지가 부족한 가짜 후보 - 본문 속 목록일 가능성이 높으니 건너뛰고 계속 찾는다.
      cursor = candidate + 1;
    }

    if (accepted === null) break;
    blocks.push({ n, start: accepted, end: text.length });
    prevStart = accepted;
    searchFrom = accepted + 1;
  }
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].end = blocks[i + 1].start;
  }
  return blocks;
}

// 마지막 선택지에는 페이지 머리말(쪽수/영역명)이나 "확인 사항" 안내문이 덧붙는 경우가 많아 제거한다.
function sanitizeChoice(raw: string): string {
  let text = raw.trim();
  const noisePatterns = [
    /\*?\s*확인\s*사항[\s\S]*$/,
    /고\s*1\s*한국사\s*영역[\s\S]*$/,
    /한국사\s*영역\s*고\s*1[\s\S]*$/,
  ];
  for (const pattern of noisePatterns) {
    text = text.replace(pattern, '').trim();
  }
  // 문장이 "다 ." 또는 "?" 로 끝난 뒤에 남아있는 숫자/공백 잔여물 제거
  const sentenceEnd = text.search(/[.?][^.?]*$/);
  if (sentenceEnd !== -1) {
    text = text.slice(0, sentenceEnd + 1);
  }
  return text.trim();
}

interface ParsedQuestion {
  number: number;
  stem: string;
  choices: string[];
}

function parseQuestions(text: string): ParsedQuestion[] {
  const blocks = splitBySequentialNumber(text, /[^0-9]/, 20);
  const questions: ParsedQuestion[] = [];

  for (const block of blocks) {
    const raw = text.slice(block.start, block.end);
    const body = raw.replace(new RegExp(`^${block.n}\\s*\\.\\s*`), '');

    const firstCircleIdx = body.search(/[①②③④⑤]/);
    if (firstCircleIdx === -1) continue;

    const stem = body.slice(0, firstCircleIdx).trim();
    const choicesText = body.slice(firstCircleIdx);

    const choices: string[] = [];
    for (let i = 0; i < CIRCLES.length; i++) {
      const startMarker = CIRCLES[i];
      const endMarker = CIRCLES[i + 1];
      const startIdx = choicesText.indexOf(startMarker);
      if (startIdx === -1) continue;
      const endIdx = endMarker ? choicesText.indexOf(endMarker, startIdx) : choicesText.length;
      const choiceText = sanitizeChoice(
        choicesText.slice(startIdx + 1, endIdx === -1 ? undefined : endIdx)
      );
      choices.push(choiceText);
    }

    if (choices.length === 5 && stem.length > 0) {
      questions.push({ number: block.n, stem, choices });
    }
  }

  return questions;
}

interface ParsedExplanation {
  number: number;
  explanation: string;
}

function parseAnswerKey(text: string): Map<number, number> {
  const map = new Map<number, number>();
  const re = /(\d{1,2})\s*([①②③④⑤])/g;
  let match: RegExpExecArray | null;
  let expected = 1;
  while ((match = re.exec(text)) && expected <= 20) {
    const n = parseInt(match[1], 10);
    if (n === expected) {
      map.set(n, CIRCLES.indexOf(match[2]) + 1);
      expected++;
    }
  }
  return map;
}

function parseExplanations(text: string): ParsedExplanation[] {
  const markerIdx: number[] = [];
  const re = /(\d{1,2})\s*\.\s*\[\s*출제의도\s*\]/g;
  let match: RegExpExecArray | null;
  const positions: { n: number; idx: number }[] = [];
  while ((match = re.exec(text))) {
    positions.push({ n: parseInt(match[1], 10), idx: match.index });
  }

  const explanations: ParsedExplanation[] = [];
  for (let i = 0; i < positions.length; i++) {
    const { n, idx } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].idx : text.length;
    const explanation = text.slice(idx, end).replace(new RegExp(`^${n}\\s*\\.\\s*`), '').trim();
    explanations.push({ n, explanation } as any);
  }
  return explanations.map((e: any) => ({ number: e.n, explanation: e.explanation }));
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
  pageNo: number;
  pageImageKey: string;
  sourceFiles: { mun: string; hsj: string };
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.log('data/exam-pdf 폴더가 없습니다.');
    return;
  }

  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .filter((f) => !SKIP_MUN_FILES.has(f));
  const munFiles = files.filter((f) => f.includes('_mun_'));
  const hsjFiles = files.filter((f) => f.includes('_hsj_'));

  console.log(`문제지 ${munFiles.length}개, 해설지 ${hsjFiles.length}개 발견`);

  type Parsed = {
    file: string;
    year: number | null;
    month: number | null;
    examName: string;
    text: string;
    numPages: number;
  };

  const munParsed: Parsed[] = [];
  for (const f of munFiles) {
    const { text, numPages } = await extractText(path.join(DIR, f));
    const { year, month, examName } = extractYearMonth(text);
    munParsed.push({ file: f, year, month, examName, text, numPages });
    console.log(`[문제지] ${f} -> ${examName} (${text.length}자, ${numPages}페이지)`);
  }

  const hsjParsed: Parsed[] = [];
  for (const f of hsjFiles) {
    const { text, numPages } = await extractText(path.join(DIR, f));
    const { year, month, examName } = extractYearMonth(text);
    hsjParsed.push({ file: f, year, month, examName, text, numPages });
    console.log(`[해설지] ${f} -> ${examName} (${text.length}자)`);
  }

  const results: ExamQuestion[] = [];
  const unmatched: string[] = [];
  const roundsMeta: { year: number; month: number | null; munFile: string; numPages: number }[] = [];

  for (const mun of munParsed) {
    if (mun.year === null) {
      unmatched.push(`${mun.file} (연도 인식 실패)`);
      continue;
    }
    const manualHsjFile = MANUAL_PAIRS[mun.file];
    const hsj = manualHsjFile
      ? hsjParsed.find((h) => h.file === manualHsjFile)
      : hsjParsed.find((h) => h.year === mun.year && h.month === mun.month);
    if (!hsj) {
      unmatched.push(`${mun.file} (짝이 되는 해설지 못 찾음: ${mun.examName})`);
      continue;
    }

    const questions = parseQuestions(mun.text);
    const answerKey = parseAnswerKey(hsj.text);
    const explanations = parseExplanations(hsj.text);
    const explanationMap = new Map(explanations.map((e) => [e.number, e.explanation]));

    for (const q of questions) {
      const pageNo = estimatePageNo(q.number, mun.numPages);
      results.push({
        id: `${mun.year}-${mun.month ?? 'csat'}-${q.number}`,
        year: mun.year,
        month: mun.month,
        examName: mun.examName,
        number: q.number,
        stem: q.stem,
        choices: q.choices,
        answer: answerKey.get(q.number) ?? null,
        explanation: explanationMap.get(q.number) ?? '',
        wrongRate: null,
        pageNo,
        pageImageKey: `${mun.year}-${mun.month ?? 'csat'}-${pageNo}`,
        sourceFiles: { mun: mun.file, hsj: hsj.file },
      });
    }

    roundsMeta.push({ year: mun.year, month: mun.month, munFile: mun.file, numPages: mun.numPages });

    console.log(
      `매칭 완료: ${mun.examName} - 문제 ${questions.length}개 / 정답 ${answerKey.size}개 / 해설 ${explanations.length}개`
    );
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n총 ${results.length}문제 저장 완료: ${OUT_PATH}`);

  const META_PATH = path.join(process.cwd(), 'data', 'exam_rounds_meta.json');
  fs.writeFileSync(META_PATH, JSON.stringify(roundsMeta, null, 2), 'utf-8');

  if (unmatched.length > 0) {
    console.log('\n⚠ 매칭 실패:');
    unmatched.forEach((u) => console.log(`  - ${u}`));
  }

  const incomplete = results.filter((r) => r.answer === null || !r.explanation || r.choices.length !== 5);
  if (incomplete.length > 0) {
    console.log(`\n⚠ 일부 항목 누락 (${incomplete.length}개) - 확인 필요:`);
    incomplete.slice(0, 10).forEach((r) => console.log(`  - ${r.id}: 정답=${r.answer}, 해설길이=${r.explanation.length}, 선택지수=${r.choices.length}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
