// 사용법: scripts/parse-exam-pdfs.ts로 data/exam_questions.json을 만든 뒤 실행
// npx tsx scripts/load-exam-questions.ts
import fs from 'fs';
import path from 'path';
import { clearExamQuestions, insertExamQuestion } from '../lib/db';

const JSON_PATH = path.join(process.cwd(), 'data', 'exam_questions.json');

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
