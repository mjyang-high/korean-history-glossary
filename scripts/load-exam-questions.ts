// 사용법: scripts/parse-exam-pdfs.ts -> scripts/render-exam-pages.ts 실행 후
// npx tsx scripts/load-exam-questions.ts
import fs from 'fs';
import path from 'path';
import { clearExamQuestions, insertExamQuestion, clearExamQuestionImages, insertExamQuestionImage } from '../lib/db';

const JSON_PATH = path.join(process.cwd(), 'data', 'exam_questions.json');
const QUESTION_IMAGE_DIR = path.join(process.cwd(), 'data', 'exam-question-images');

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
  pageNo: number | null;
}

async function main() {
  if (!fs.existsSync(JSON_PATH)) {
    console.log('data/exam_questions.json이 없습니다. 먼저 npx tsx scripts/parse-exam-pdfs.ts를 실행하세요.');
    return;
  }

  const questions: ExamQuestion[] = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

  await clearExamQuestions();
  for (const q of questions) {
    await insertExamQuestion(q);
  }
  console.log(`${questions.length}문제를 DB에 저장했습니다.`);

  if (fs.existsSync(QUESTION_IMAGE_DIR)) {
    const files = fs.readdirSync(QUESTION_IMAGE_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
    await clearExamQuestionImages();
    for (const file of files) {
      const id = file.replace(/\.png$/i, '');
      const base64 = fs.readFileSync(path.join(QUESTION_IMAGE_DIR, file)).toString('base64');
      await insertExamQuestionImage(id, base64);
    }
    console.log(`${files.length}개 문항 이미지를 DB에 저장했습니다.`);
  } else {
    console.log('data/exam-question-images 폴더가 없어 문항 이미지는 건너뜁니다. (scripts/render-exam-pages.ts 먼저 실행)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
