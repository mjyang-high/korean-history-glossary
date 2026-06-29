// 사용법: scripts/parse-exam-pdfs.ts 실행 후 npx tsx scripts/render-exam-pages.ts
// 문제지 PDF에서 문항별로 사진ㆍ지도ㆍ표가 포함된 영역만 정확히 잘라서
// data/exam-question-images/{questionId}.png 로 저장한다. (2단 레이아웃 인식)
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Path2D, Image, ImageData } from '@napi-rs/canvas';

(global as any).Path2D = Path2D;
(global as any).Image = Image;
(global as any).ImageData = ImageData;

const SOURCE_DIR = path.join(process.cwd(), 'data', 'exam-pdf');
const OUT_DIR = path.join(process.cwd(), 'data', 'exam-question-images');
const CMAP_URL = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps') + path.sep;
const META_PATH = path.join(process.cwd(), 'data', 'exam_rounds_meta.json');

const SCALE = 2.0;
const TOP_MARGIN = 26;
const BOTTOM_GAP = 26;
const SIDE_MARGIN = 14;
const FULL_WIDTH_THRESHOLD_RATIO = 0.58;

interface RoundMeta {
  year: number;
  month: number | null;
  munFile: string;
  numPages: number;
}

interface ItemBox {
  str: string;
  charStart: number;
  x0: number;
  yTop: number;
  x1: number;
}

// 공백이 여러 칸 겹치면 페이지 번호 등이 문항 번호로 잘못 매칭될 수 있어, 텍스트를 이어붙일 때
// 1칸 공백만 유지한다. charStart는 이 항목의 (정리된) 텍스트가 pageText에서 시작하는 위치다.
function buildPageItems(items: any[], viewport: any): { items: ItemBox[]; pageText: string } {
  let pageText = '';
  const boxes: ItemBox[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const trimmed = item.str.replace(/\s+/g, ' ').replace(/^ /, '');
    if (!trimmed) continue;

    if (pageText.length > 0 && !pageText.endsWith(' ')) pageText += ' ';
    const charStart = pageText.length;
    pageText += trimmed;

    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const [vx0, vy0] = pdfjsLib.Util.applyTransform([x, y], viewport.transform);
    const [vx1] = pdfjsLib.Util.applyTransform([x + (item.width ?? 0), y], viewport.transform);
    boxes.push({ str: item.str, charStart, x0: Math.min(vx0, vx1), yTop: vy0, x1: Math.max(vx0, vx1) });
  }
  return { items: boxes, pageText };
}

// 이 페이지 텍스트에서 "N. " 마커가 startN, startN+1, ... 순서로 나오는 지점을 찾는다.
function findQuestionMarkers(pageText: string, startN: number, endN: number) {
  const found: { n: number; charOffset: number }[] = [];
  let searchFrom = 0;
  for (let n = startN; n <= endN; n++) {
    const re = new RegExp(`(?:^|[^0-9])(${n})\\s*\\.\\s*[^0-9]`);
    const slice = pageText.slice(searchFrom);
    const match = slice.match(re);
    if (!match || match.index === undefined) break;
    const offset = searchFrom + match.index + match[0].indexOf(String(n));
    found.push({ n, charOffset: offset });
    searchFrom = offset + 1;
  }
  return found;
}

function nearestItemAt(items: ItemBox[], charOffset: number): ItemBox | null {
  let best: ItemBox | null = null;
  for (const it of items) {
    if (it.charStart <= charOffset) best = it;
    else break;
  }
  return best ?? items[0] ?? null;
}

interface ImageBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const IDENTITY = [1, 0, 0, 1, 0, 0];
const INK_RATIO_THRESHOLD = 0.1;

// 이미지 op(paintImageXObject 등)이 가리키는 원본 픽셀 데이터를 직접 들여다보고
// "흰 바탕에 옅은 선 하나뿐인" 장식용 배경(코너 장식 등)인지 판단한다.
// 실제 사진ㆍ지도ㆍ표는 선/음영/색이 많아 잉크 비율(밝기 235 미만 픽셀 비율)이 뚜렷하게 높다.
// page.render()가 끝난 뒤에만 호출해야 한다 (그 전에는 이미지 디코딩이 끝나지 않아 값을 못 가져올 수 있음).
function isDecorativeImage(page: any, fn: number, args: any[]): boolean {
  let raw: any = null;
  if (fn === pdfjsLib.OPS.paintImageXObject) {
    try {
      raw = page.objs.get(args[0]);
    } catch {
      return false; // 판단 불가하면 안전하게 실제 이미지로 취급
    }
  } else if (fn === pdfjsLib.OPS.paintInlineImageXObject || fn === pdfjsLib.OPS.paintImageMaskXObject) {
    raw = args[0];
  }
  if (!raw || !raw.data || !raw.width || !raw.height) return false;
  const data = raw.data as Uint8ClampedArray;
  const bytesPerPixel = data.length / (raw.width * raw.height);
  if (!Number.isFinite(bytesPerPixel) || bytesPerPixel < 1) return false;
  const step = Math.max(1, Math.round(bytesPerPixel)) * 5;
  let ink = 0;
  let total = 0;
  for (let p = 0; p < data.length; p += step) {
    if (data[p] < 235) ink++;
    total++;
  }
  if (total === 0) return false;
  return ink / total < INK_RATIO_THRESHOLD;
}

// PDF 콘텐츠 스트림을 따라가며 save/restore/transform(cm)/Form XObject 진입을 추적해
// 실제로 그려지는 사진ㆍ도표 이미지의 사용자 공간 위치(유닛 정사각형을 현재 CTM으로 변환한 박스)를 구하고,
// 뷰포트(픽셀) 좌표로 변환해 반환한다. 텍스트는 다루지 않으므로 본문/선택지와는 자연히 분리된다.
async function extractImageBoxes(page: any, viewport: any): Promise<ImageBox[]> {
  const opList = await page.getOperatorList();
  const { fnArray, argsArray } = opList;
  const boxes: ImageBox[] = [];
  const stack: number[][] = [];
  let ctm = IDENTITY;

  const unitSquareBox = (m: number[]): { x0: number; y0: number; x1: number; y1: number } => {
    const corners = [
      pdfjsLib.Util.applyTransform([0, 0], m),
      pdfjsLib.Util.applyTransform([1, 0], m),
      pdfjsLib.Util.applyTransform([0, 1], m),
      pdfjsLib.Util.applyTransform([1, 1], m),
    ];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const userBox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    const p0 = pdfjsLib.Util.applyTransform([userBox.x0, userBox.y0], viewport.transform);
    const p1 = pdfjsLib.Util.applyTransform([userBox.x1, userBox.y1], viewport.transform);
    return {
      x0: Math.min(p0[0], p1[0]),
      x1: Math.max(p0[0], p1[0]),
      y0: Math.min(p0[1], p1[1]),
      y1: Math.max(p0[1], p1[1]),
    };
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    switch (fn) {
      case pdfjsLib.OPS.save:
        stack.push(ctm);
        break;
      case pdfjsLib.OPS.restore:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case pdfjsLib.OPS.transform:
        ctm = pdfjsLib.Util.transform(ctm, args as number[]);
        break;
      case pdfjsLib.OPS.paintFormXObjectBegin:
        stack.push(ctm);
        if (args && args[0]) ctm = pdfjsLib.Util.transform(ctm, args[0] as number[]);
        break;
      case pdfjsLib.OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? IDENTITY;
        break;
      case pdfjsLib.OPS.paintImageXObject:
      case pdfjsLib.OPS.paintInlineImageXObject:
      case pdfjsLib.OPS.paintImageMaskXObject:
        if (!isDecorativeImage(page, fn, args)) {
          boxes.push(unitSquareBox(ctm));
        }
        break;
      default:
        break;
    }
  }
  return boxes;
}

async function renderQuestionsOnPage(
  doc: any,
  pageNo: number,
  startN: number,
  endN: number
): Promise<{ foundNumbers: number[]; images: { number: number; buffer: Buffer }[] }> {
  const page = await doc.getPage(pageNo);
  const viewport = page.getViewport({ scale: SCALE });
  const pageCanvas = createCanvas(viewport.width, viewport.height);
  const pageCtx = pageCanvas.getContext('2d');
  await page.render({ canvasContext: pageCtx as any, viewport }).promise;

  const tc = await page.getTextContent();
  const { items, pageText } = buildPageItems(tc.items as any[], viewport);

  const markers = findQuestionMarkers(pageText, startN, endN);
  if (markers.length === 0) return { foundNumbers: [], images: [] };

  const midpoint = viewport.width / 2;

  const rawAnchors = markers.map((m) => {
    const anchorItem = nearestItemAt(items, m.charOffset);
    const nextMarker = markers.find((mm) => mm.charOffset > m.charOffset);
    const rangeEnd = nextMarker ? nextMarker.charOffset : pageText.length;
    const markerX0 = anchorItem?.x0 ?? 0;
    let minX0 = markerX0;
    let maxX1 = anchorItem?.x1 ?? midpoint;
    for (const it of items) {
      if (it.charStart >= m.charOffset && it.charStart < rangeEnd) {
        minX0 = Math.min(minX0, it.x0);
        maxX1 = Math.max(maxX1, it.x1);
      }
    }
    const yTop = anchorItem?.yTop ?? 0;
    const fullWidth = maxX1 - markerX0 > viewport.width * FULL_WIDTH_THRESHOLD_RATIO;
    return { number: m.n, markerX0, minX0, maxX1, yTop, fullWidth };
  });

  // 우측 단의 실제 시작 x 좌표는 페이지 정중앙과 정확히 일치하지 않을 수 있어,
  // 문항 번호의 시작 x좌표들을 정렬해 가장 큰 간격(gap)을 기준으로 좌/우 단을 나눈다.
  // (열 구분은 세로 경계 계산에만 쓰고, 실제 자르는 가로 폭은 각 문항 내용의 실제 범위를 따른다.)
  const sortedX = [...new Set(rawAnchors.map((a) => a.markerX0))].sort((a, b) => a - b);
  let splitPoint = midpoint;
  if (sortedX.length > 1) {
    let maxGap = -1;
    for (let i = 0; i < sortedX.length - 1; i++) {
      const gap = sortedX[i + 1] - sortedX[i];
      if (gap > maxGap) {
        maxGap = gap;
        splitPoint = (sortedX[i] + sortedX[i + 1]) / 2;
      }
    }
  }

  const anchors = rawAnchors.map((a) => ({
    ...a,
    column: (a.markerX0 < splitPoint ? 'L' : 'R') as 'L' | 'R',
  }));

  const anchorsWithBoundary = anchors.map((a) => {
    const laterSameGroup = anchors.filter(
      (b) => b.yTop > a.yTop && (b.column === a.column || b.fullWidth)
    );
    const bottomBoundary =
      laterSameGroup.length > 0
        ? Math.min(...laterSameGroup.map((b) => b.yTop))
        : viewport.height;
    return { ...a, bottomBoundary };
  });

  if (process.env.DEBUG_ANCHORS) {
    console.log(`page ${pageNo} anchors:`, anchorsWithBoundary);
  }

  // 그림 영역(이미지 XObject)만 추출해 각 문항(앵커)에 배정한다.
  // 세로 위치가 해당 문항의 [yTop, bottomBoundary] 범위에 들어오고, 같은 단(column)에 속하는
  // 이미지만 그 문항 것으로 인정한다 (다른 문항의 그림이 섞여 들어가는 것을 방지).
  const imageBoxes = await extractImageBoxes(page, viewport);
  const MIN_IMAGE_SIZE = 20;

  const images: { number: number; buffer: Buffer }[] = [];

  for (const a of anchorsWithBoundary) {
    const assigned = imageBoxes.filter((box) => {
      if (box.x1 - box.x0 < MIN_IMAGE_SIZE || box.y1 - box.y0 < MIN_IMAGE_SIZE) return false;
      const centerY = (box.y0 + box.y1) / 2;
      const centerX = (box.x0 + box.x1) / 2;
      if (centerY < a.yTop - TOP_MARGIN || centerY > a.bottomBoundary) return false;
      if (a.fullWidth) return true;
      const boxColumn: 'L' | 'R' = centerX < splitPoint ? 'L' : 'R';
      return boxColumn === a.column;
    });

    if (assigned.length === 0) continue;

    const x0 = Math.max(0, Math.min(...assigned.map((b) => b.x0)) - SIDE_MARGIN);
    const x1 = Math.min(viewport.width, Math.max(...assigned.map((b) => b.x1)) + SIDE_MARGIN);
    const y0 = Math.max(0, Math.min(...assigned.map((b) => b.y0)) - SIDE_MARGIN);
    const y1 = Math.min(viewport.height, Math.max(...assigned.map((b) => b.y1)) + SIDE_MARGIN);

    const sw = x1 - x0;
    const sh = y1 - y0;
    if (sw < MIN_IMAGE_SIZE || sh < MIN_IMAGE_SIZE) continue;

    const cropCanvas = createCanvas(sw, sh);
    const cropCtx = cropCanvas.getContext('2d');
    (cropCtx as any).drawImage(pageCanvas, x0, y0, sw, sh, 0, 0, sw, sh);
    images.push({ number: a.number, buffer: cropCanvas.toBuffer('image/png') });
  }

  return { foundNumbers: markers.map((m) => m.n), images };
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
    const totalQuestions = 20;

    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({
      data,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    // 문항이 페이지마다 균등하게(5/5/5/5) 나뉘지 않는 회차가 있어, 이전 페이지에서 찾은
    // 마지막 문항 번호 다음부터 이어서 찾는다 (고정 분할 대신 누적 진행 방식).
    let nextN = 1;
    for (let pageNo = 1; pageNo <= round.numPages && nextN <= totalQuestions; pageNo++) {
      const startN = nextN;
      const { foundNumbers, images } = await renderQuestionsOnPage(doc, pageNo, startN, totalQuestions);
      for (const img of images) {
        const id = `${round.year}-${round.month ?? 'csat'}-${img.number}`;
        fs.writeFileSync(path.join(OUT_DIR, `${id}.png`), img.buffer);
      }
      if (foundNumbers.length > 0) {
        nextN = Math.max(...foundNumbers) + 1;
      }
      console.log(
        `${round.year}-${round.month ?? 'csat'} ${pageNo}페이지: 문항 ${foundNumbers.length}개 인식, 그림 ${images.length}개 추출 (${startN}번부터)`
      );
    }
    if (nextN <= totalQuestions) {
      console.log(`⚠ ${round.year}-${round.month ?? 'csat'}: ${nextN}번부터 ${totalQuestions}번까지 못 찾음`);
    }
  }

  console.log('\n모든 문항 이미지 잘라내기 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
