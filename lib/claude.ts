import Anthropic from '@anthropic-ai/sdk';
import { ContextSnippet } from './search';
import { ExamTermInfo } from './examTerms';

const MODEL = 'claude-haiku-4-5';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    client = new Anthropic({ apiKey });
  }
  return client;
}

function formatContexts(contexts: ContextSnippet[]): string {
  return contexts
    .map((c, i) => {
      const unitLabel = c.unit ? ` / ${c.unit}` : '';
      return `[문맥 ${i + 1}] (${c.book} ${c.pageNo}쪽${unitLabel})\n${c.snippet}`;
    })
    .join('\n\n');
}

export async function explainTerm(
  term: string,
  contexts: ContextSnippet[],
  examInfo: ExamTermInfo | null
): Promise<string> {
  const contextsText = formatContexts(contexts);

  const prompt = `너는 성적 하위권 고등학생에게 한국사 용어를 설명해주는 친절한 과외 선생님이야.
아래는 한국사 교과서에서 "${term}"이라는 단어가 등장하는 실제 문맥들이야.

${contextsText}

위 문맥을 참고해서 "${term}"을 설명해줘. 다음 조건을 꼭 지켜줘:
1. 사전처럼 딱딱하게 정의만 말하지 말고, 일상적이고 쉬운 표현으로 풀어서 설명해줘. 성적이 낮은 학생도 바로 이해할 수 있어야 해.
2. "교과서 ○○쪽/○○단원에 나옴" 형태로 등장 위치를 알려줘 (위 문맥의 책 이름과 쪽수를 활용해).
3. 이 단어와 대조되거나 대비되는 다른 개념이 교과서 문맥에 있다면 같이 설명해줘 (예: "A는 B와 반대되는 개념이야").
4. 비슷한 뜻의 한자어나 유의어가 있으면 같이 알려줘.
5. 구체적인 예시나 비유, 상황을 들어서 설명해줘.
6. 답변은 친근하고 편안한 구어체로, 너무 길지 않게(5~8문장 정도) 작성해줘. 단, 어른이나 선생님이 같이 보고 있어도 어색하지 않을 만큼 정중하고 단정한 표현을 써줘. "다 해 먹는다"처럼 거칠거나 과격하거나 비속어 느낌이 나는 표현은 절대 쓰지 마.
7. 마크다운 문법(별표, # 등)은 쓰지 말고 자연스러운 줄글과 줄바꿈만 사용해줘.

${
  examInfo
    ? `참고로 이 단어는 최근 5개년 수능 기출과 다음과 같이 연계돼: "${examInfo.recentExamInfo}". 이 내용도 답변 끝에 짧게 언급해줘.`
    : ''
}`;

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
}
