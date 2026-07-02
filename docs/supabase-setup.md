# Supabase 설정 순서

이 문서는 `나의 비서`를 여러 기기에서 같은 사용자로 쓰기 위한 Supabase 설정 절차다.

## 1. Supabase 프로젝트 만들기

1. Supabase Dashboard에 로그인한다.
2. 새 프로젝트를 만든다.
3. Region은 가까운 지역을 고른다.
4. 프로젝트 생성이 끝날 때까지 기다린다.

## 2. SQL 실행

Supabase Dashboard의 SQL Editor에서 아래 migration 파일들을 순서대로 실행한다.

1. `supabase/migrations/20260701000000_create_profiles_devices.sql`
2. `supabase/migrations/20260701001000_create_user_app_data.sql`
3. `supabase/migrations/20260702000000_add_profile_travel_mode.sql`
4. `supabase/migrations/20260702001000_create_travel_time_estimates.sql`

생성되는 주요 테이블:

- `profiles`
- `devices`
- `assistant_items`
- `routine_schedules`
- `single_schedules`
- `places`
- `travel_time_rules`
- `travel_time_estimates`

모든 사용자 데이터 테이블은 `user_id`를 기준으로 분리되고, Row Level Security 정책으로 자기 데이터만 읽고 쓸 수 있게 한다.

## 3. API 키 확인

Supabase Dashboard에서 Project Settings > API로 이동해 아래 값을 확인한다.

- Project URL
- Publishable key 또는 anon public key

## 4. 로컬 환경변수

`.env.local`에 아래 값을 넣는다.

```text
NEXT_PUBLIC_SUPABASE_URL=프로젝트_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable_key
OPENAI_API_KEY=OpenAI_API_키
KAKAO_REST_API_KEY=카카오_REST_API_키
ODSAY_API_KEY=ODsay_API_키
```

`OPENAI_API_KEY`는 AI 분류를 실제 OpenAI API로 사용하려면 필요하다. 없으면 규칙 기반 분류로 fallback된다.
`KAKAO_REST_API_KEY`는 주소를 좌표로 변환할 때 사용한다.
`ODSAY_API_KEY`는 대중교통 경로 시간을 계산할 때 사용한다.

## 5. Vercel 환경변수

Vercel 프로젝트의 Settings > Environment Variables에 같은 값을 추가한다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `KAKAO_REST_API_KEY`
- `ODSAY_API_KEY`

추가 후 Production 재배포가 필요하다.

## 6. 앱에서 테스트

1. `/account` 페이지로 이동한다.
2. 이메일 회원가입 또는 소셜 로그인을 선택한다.
3. 같은 기기에서 이메일 링크를 열거나 OAuth 로그인을 완료한다.
4. 사용자 이름과 AI 분류 기준을 저장한다.
5. 현재 기기 연결 상태가 표시되는지 확인한다.
6. 아이폰에서도 같은 계정으로 로그인해 기기가 같은 사용자로 연결되는지 확인한다.

이 단계가 끝나면 같은 사용자 아래에 여러 기기가 연결되는 구조가 준비된다. 실제 기록/일정 저장소를 DB 기반으로 교체하는 작업은 다음 단계다.

## 연결 확인 명령

로컬 `.env.local` 설정 후 아래 명령으로 Supabase 연결을 확인한다.

```bash
npm run check:supabase
```

정상 연결되면 `Supabase connection OK`가 출력된다.

## 소셜 로그인 설정

앱에는 Google, Apple, Kakao 버튼이 있다. 실제 동작을 위해서는 Supabase Dashboard의 Authentication > Providers에서 각 provider를 켜고, 각 서비스 개발자 콘솔에서 발급한 Client ID/Secret을 등록해야 한다.

Supabase JavaScript 클라이언트는 `signInWithOAuth`로 소셜 로그인을 시작하고, `redirectTo`로 로그인 후 돌아올 주소를 지정한다. 공식 문서: https://supabase.com/docs/reference/javascript/auth-signinwithoauth

네이버는 Supabase 기본 provider 목록에 없으므로 앱에서는 준비 중 버튼으로 표시한다. 나중에 커스텀 OAuth/OIDC 또는 별도 인증 중계 서버를 붙이는 방식으로 확장한다.
