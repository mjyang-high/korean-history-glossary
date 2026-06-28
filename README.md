# 한국사 용어 도우미

교과서 PDF에서 모르는 단어를 검색하면 Claude API가 문맥에 맞춰 쉽게 설명해주는 앱입니다.

## 처음 설정

1. 의존성 설치
   ```
   npm install
   ```

2. 환경변수 설정
   `.env.local.example`을 복사해서 `.env.local`을 만들고 값을 채워주세요.
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   CLASS_PASSWORD=원하는 비밀번호
   ```

3. 교과서 PDF 넣기
   `data/source-pdf/` 폴더에 한국사1.pdf, 한국사2.pdf 등을 넣어주세요. 파일 이름이 화면에 "○○쪽" 표시할 때 책 이름으로 쓰입니다.

4. PDF 추출 및 인덱싱
   ```
   npm run extract-pdf
   ```
   `data/app.db` (SQLite)에 페이지별 텍스트가 저장됩니다. PDF를 새로 추가하거나 교체하면 다시 실행하세요.

5. 개발 서버 실행
   ```
   npm run dev
   ```
   http://localhost:3000 접속 → 반 비밀번호 입력 → 검색

## 수능 기출 연계 정보 채우기

`data/exam_terms.xlsx` 파일을 만들어 다음 컬럼으로 채우면 검색 결과에 함께 표시됩니다.

| 용어 | 최근5개년기출연계 |
|------|------------------|
| 공화정 | 2023, 2021학년도 수능에서 OO 사료와 함께 출제됨 |

(xlsx 대신 `data/exam_terms.json`을 `[{"term": "공화정", "recentExamInfo": "..."}]` 형태로 채워도 됩니다. xlsx가 있으면 xlsx를 우선 사용합니다.)

표에 없는 단어는 기출 연계 정보 없이 일반 설명만 표시됩니다.

## 배포 (Vercel + Neon Postgres)

반 전체가 접속할 수 있는 공개 주소가 필요하면 Vercel에 배포합니다. Vercel은 서버 파일시스템이 매 요청마다 새로 생성되는 서버리스 구조라 로컬 파일 DB(SQLite) 대신 외부 Postgres(Neon)를 사용합니다.

1. 이 폴더를 GitHub 저장소에 올립니다 (PDF 원본은 `.gitignore`로 제외되어 있으니 저장소에는 안 올라갑니다).
2. [vercel.com](https://vercel.com)에서 새 프로젝트로 그 저장소를 가져옵니다 (Import).
3. 프로젝트의 **Storage** 탭에서 **Postgres**(Neon) 데이터베이스를 하나 만들고 프로젝트에 연결합니다. 연결하면 `DATABASE_URL`(또는 `POSTGRES_URL`) 환경변수가 프로젝트에 자동으로 추가됩니다.
4. 프로젝트 **Settings → Environment Variables**에 다음을 추가합니다.
   - `ANTHROPIC_API_KEY`
   - `CLASS_PASSWORD`
5. PDF에서 추출한 페이지 데이터를 Postgres에 넣어야 합니다. 로컬에서:
   ```
   vercel env pull .env.local
   npm run extract-pdf
   ```
   `vercel env pull`로 받은 `.env.local`에는 방금 만든 Postgres 연결 정보가 들어있어서, 로컬에서 실행한 추출 스크립트가 그 Postgres에 바로 데이터를 채웁니다.
6. Vercel에서 배포(Deploy)하면 끝입니다. 배포된 주소를 반 친구들에게 공유하면 됩니다.

PDF를 새로 추가하거나 교체할 때도 같은 방식(로컬에서 `npm run extract-pdf` 실행)으로 Postgres를 갱신하면 됩니다.

## 동작 방식

- 검색 → 단어가 들어있는 모든 페이지를 SQLite에서 찾아 문맥 스니펫을 추출
- 처음 검색하는 단어면 Claude(`claude-haiku-4-5`)에게 문맥과 함께 보내 설명 생성 후 캐시에 저장
- 이미 캐시된 단어는 API를 다시 부르지 않고 저장된 설명을 바로 보여줌 (비용 절약)
- 검색할 때마다 단어별 누적 횟수만 기록 (이름/학번 등 개인 식별 정보는 저장하지 않음)
- 화면 오른쪽에 누적 검색 횟수 기준 TOP 10 표시
- 반 전체 비밀번호 하나로 익명 입장 (쿠키 기반, 이름/학번 입력 없음)

## 단원 인식 관련 참고

`scripts/extract-pdf.ts`는 페이지 텍스트에서 "Ⅰ.", "n단원", "제n장" 같은 패턴을 휴리스틱으로 찾아 단원명을 추정합니다. 교과서 디자인에 따라 정확하지 않을 수 있으니, 필요하면 `UNIT_PATTERNS` 정규식을 교과서 실제 형식에 맞게 수정하세요.
