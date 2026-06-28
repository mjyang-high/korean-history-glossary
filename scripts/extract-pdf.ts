// 사용법: data/source-pdf/ 폴더에 PDF를 넣고 `npm run extract-pdf` 실행
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { clearPages, insertPage } from '../lib/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.join(process.cwd(), 'data', 'source-pdf');
const CMAP_URL = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'cmaps') + path.sep;

// 교과서 단원 제목으로 흔히 쓰이는 패턴들 (해냄에듀 한국사1/2 기준 휴리스틱)
const UNIT_PATTERNS = [
  /^(?:대단원\s*)?([IVX]+)\.\s*(.{2,40})$/m,
  /^(\d{1,2})\s*단원\s*(.{0,40})$/m,
  /^제\s*(\d{1,2})\s*장\s*(.{0,40})$/m,
  /^(\d{1,2})\.\s*(.{2,40})$/m,
];

function detectUnit(pageText: string): string | null {
  for (const pattern of UNIT_PATTERNS) {
    const match = pageText.match(pattern);
    if (match) {
      return match[0].trim().slice(0, 60);
    }
  }
  return null;
}

async function extractBook(filePath: string, bookName: string) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  let lastUnit: string | null = null;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');

    const detected = detectUnit(text);
    if (detected) lastUnit = detected;
    await insertPage(bookName, pageNo, lastUnit, text);
  }

  console.log(`${bookName}: ${doc.numPages}페이지 저장 완료`);
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log('data/source-pdf 폴더가 없습니다. 먼저 PDF를 넣어주세요.');
    return;
  }

  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    console.log('data/source-pdf 폴더에 PDF가 없습니다. 한국사1.pdf, 한국사2.pdf 등을 넣어주세요.');
    return;
  }

  await clearPages();

  for (const file of files) {
    const bookName = path.basename(file, path.extname(file));
    await extractBook(path.join(SOURCE_DIR, file), bookName);
  }

  console.log('추출 완료. 검색 앱에서 바로 사용할 수 있습니다.');
}

main().catch((err) => {
  console.error('PDF 추출 중 오류:', err);
  process.exit(1);
});
