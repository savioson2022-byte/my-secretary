# 모바일 사용과 기기 등록 계획

## 현재 모바일 사용 방식

현재 앱은 PWA 설치 기반으로 모바일에서 사용하는 방향이다.

권장 흐름:

1. GitHub에 최신 코드를 push한다.
2. Vercel에 배포한다.
3. iPhone Safari에서 배포 주소를 연다.
4. 공유 버튼에서 홈 화면에 추가한다.
5. 홈 화면 앱으로 실행한다.

모바일 화면에서는 홈 입력 화면을 앱 첫 화면처럼 사용하고, 데스크톱 화면에서는 소개 영역과 저장된 기록 영역을 함께 보여준다.

## 음성 입력 방식

현재 지원 방식:

- 길게 눌러 말하기
  - 마이크 버튼을 누르는 동안 음성 인식
  - 손을 떼면 음성 인식 종료
  - 종료 후 자동 분류 시작
- 눌러 켜고 끄기
  - 한 번 누르면 음성 인식 시작
  - 다시 누르면 종료
  - 종료 후 자동 분류 시작

선택한 음성 입력 방식은 `localStorage`에 저장된다.

## 현재 계정/기기 관리 상태

Supabase Auth 기반 계정/기기 관리로 전환을 시작했다.

추가된 파일:

- `src/app/account/page.tsx`
- `src/components/AccountManager.tsx`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/config.ts`
- `supabase/migrations/20260701000000_create_profiles_devices.sql`
- `supabase/migrations/20260701001000_create_user_app_data.sql`
- `.env.example`

환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 앱은 기존처럼 동작하고, 계정 화면에서는 Supabase 연결이 필요하다는 안내와 로컬 임시 프로필을 보여준다.

환경변수가 있으면 `/account`에서 이메일 로그인 링크를 요청하고, 로그인 후 사용자 프로필과 현재 기기를 연결할 수 있다.

## 로컬 임시 프로필

저장 위치:

- `my-assistant-user-profile`

저장 내용:

- 사용자 이름 또는 별명
- 기기 이름
- 사용자별 AI 분류 기준
- 기기 기억 여부

이 방식은 현재 브라우저 안에서만 유지된다. 여러 기기를 같은 사용자로 묶으려면 Supabase Auth를 사용해야 한다.

## AI 분류 실패처럼 보이는 경우

Vercel 또는 로컬 실행 환경에 `OPENAI_API_KEY`가 없으면 실제 OpenAI API 분류를 하지 않는다.

이 경우 앱은 실패로 멈추지 않고 규칙 기반 `classifyInput.ts`로 fallback한다.

배포 환경에서 AI 분류를 사용하려면 Vercel 프로젝트 설정에 다음 환경변수를 추가해야 한다.

- `OPENAI_API_KEY`

환경변수 추가 후에는 Vercel에서 다시 배포해야 한다.

## Supabase 로그인 구현 방향

여러 사용자가 생기면 현재 로컬 프로필만으로는 충분하지 않다. Supabase Auth 같은 서버 기반 인증으로 전환한다.

권장 흐름:

1. Supabase 프로젝트 생성
2. `supabase/migrations/20260701000000_create_profiles_devices.sql` 실행
3. Vercel 환경변수 추가
4. `/account`에서 이메일 로그인 테스트
5. 현재 기기 연결
6. 다른 기기에서도 같은 이메일로 로그인해 같은 사용자로 연결
7. 기존 localStorage 데이터를 `user_id` 기준 DB 테이블로 이전

핵심 원칙:

- 휴대폰에서는 매번 로그인하지 않는다.
- 한 번 등록된 기기는 세션을 오래 유지한다.
- AI 분류 기준은 사용자별 설정으로 저장한다.
- 기록, 일정, 장소, 이동시간 규칙은 모두 `user_id` 기준으로 분리한다.
