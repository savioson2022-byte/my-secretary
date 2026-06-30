# 나의 비서 MVP

떠오른 생각, 할 일, 일정, 아이디어를 빠르게 입력하거나 말하면 AI가 분류하고 저장할 수 있는 개인 AI 비서 웹앱 MVP입니다.

## 주요 기능

- 텍스트 입력
- 마이크 버튼 기반 음성 입력
- OpenAI API 기반 입력 분류
- API 실패 또는 키 미설정 시 규칙 기반 fallback 분류
- 저장 전 분류 결과 수정
- localStorage 저장
- 단기일정 자동 캘린더 등록
- 월간 캘린더
- 주간 캘린더
- 정기 일정과 단기 일정을 제외한 빈 시간 계산
- 시간작업 배치 추천
- PWA manifest와 홈 화면 아이콘
- `/?voice=1` 음성 입력 진입 링크

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## 환경변수

`.env.example`을 참고해 로컬에서 `.env.local`을 만듭니다.

```bash
OPENAI_API_KEY=
```

`OPENAI_API_KEY`가 없으면 앱은 규칙 기반 fallback 분류를 사용합니다.

## 배포

Vercel에 GitHub 저장소를 연결해 배포합니다.

필수 환경변수:

```bash
OPENAI_API_KEY
```

배포 후 iPhone에서 `https://배포주소/?voice=1`을 단축어, 동작 버튼, 뒷면 탭에 연결하면 음성 기록 화면으로 빠르게 진입할 수 있습니다.

자세한 배포 절차는 `docs/deployment.md`를 참고합니다.
