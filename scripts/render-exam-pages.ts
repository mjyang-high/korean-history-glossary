// 사용법: scripts/parse-exam-pdfs.ts 실행 후 npx tsx scripts/render-exam-pages.ts
// 문제지 PDF의 각 페이지를 통째로 PNG로 렌더링해 data/exam-page-images/에 저장한다.
// (사진ㆍ지도ㆍ표 등 텍스트로 추출되지 않는 시각 자료를 그대로 보여주기 위함)
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Path2D, Image, ImageData } from '@napi-rs/canvas';

(global as any).Path2D = Path2D;
(global as any).Image = Image;
(global as any).ImageData = ImageData;

const SOURCE_DIR = path.join(process.cwd(), 'data', 'exam-pdf');
const OUT_DIR = path.join(process.cwd(), 'data', 'exam-page-images');
const CMAP_URL = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps') + path.sep;
const META_PATH = path.join(process.cwd(), 'data', 'exam_rounds_meta.json');

interface RoundMeta {
  year: number;
  month: number | null;
  munFile: string;
  numPages: number;
}

async function renderPage(filePath: string, pageNo: number): Promise<Buffer> {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx as any, viewport }).promise;
  return canvas.toBuffer('image/png');
}

async function main() {
  if (!fs.existsSync(META_PATH)) {
    console.log('data/exam_rounds_meta.json이 없습니다. 먼저 npx tsx scripts/parse-exam-pdfs.ts를 실행하세요.');
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rounds: RoundMeta[] = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));

  for (const round of rounds) {
    const filePath = path.join(SOURCE_DIR, round.munFile);
    if (!fs.existsSync(filePath)) {
      console.log(`파일 없음: ${round.munFile}`);
      continue;
    }
    for (let pageNo = 1; pageNo <= round.numPages; pageNo++) {
      const key = `${round.year}-${round.month ?? 'csat'}-${pageNo}`;
      const outPath = path.join(OUT_DIR, `${key}.png`);
      const buf = await renderPage(filePath, pageNo);
      fs.writeFileSync(outPath, buf);
      console.log(`렌더링 완료: ${key} (${buf.length}bytes)`);
    }
  }

  console.log('\n모든 페이지 이미지 렌더링 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
