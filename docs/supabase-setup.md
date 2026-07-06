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

먼저 Supabase Dashboard > Authentication > URL Configuration에서 아래 값을 설정한다.

- Site URL: `https://my-secretary-remote.vercel.app`
- Redirect URLs:
  - `https://my-secretary-remote.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3001/auth/callback`

이 callback 주소가 허용되어 있어야 이메일 링크와 소셜 로그인이 앱 세션으로 정상 저장된다.

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

### Google 로그인

Google 로그인은 Supabase 기본 OAuth provider를 사용한다.

1. Google Cloud Console에서 프로젝트를 만들거나 기존 프로젝트를 선택한다.
2. APIs & Services > OAuth consent screen에서 외부 사용자용 앱 정보를 설정한다.
3. APIs & Services > Credentials에서 OAuth client ID를 만든다.
4. Application type은 `Web application`으로 선택한다.
5. Authorized JavaScript origins에는 아래 값을 추가한다.

```text
https://my-secretary-remote.vercel.app
http://localhost:3000
http://localhost:3001
```

6. Authorized redirect URIs에는 Supabase Auth 콜백 주소를 추가한다.

```text
https://fesrtvxmqalkispmmhro.supabase.co/auth/v1/callback
```

7. Google에서 발급된 Client ID와 Client secret을 복사한다.
8. Supabase Dashboard > Authentication > Providers > Google로 이동한다.
9. Google provider를 ON으로 켜고 Client ID와 Client secret을 붙여넣은 뒤 저장한다.
10. 앱의 `/account` 또는 `/settings` 페이지에서 `Google로 계속하기` 버튼이 활성화되는지 확인한다.

Google provider가 꺼져 있으면 앱은 버튼을 `Google 설정 필요`로 표시한다. 설정을 저장한 뒤 새로고침하면 버튼이 다시 활성화된다.

Kakao는 Supabase 기본 OAuth가 `account_email`, `profile_image`, `profile_nickname` 동의항목을 요청한다. 앱이 아직 카카오 Biz App이 아니거나 이메일 권한이 없으면 `KOE205`가 발생할 수 있으므로, 현재 앱의 Kakao 버튼은 `/api/auth/kakao/start`에서 카카오 OIDC를 직접 시작하고 `openid profile_nickname`만 요청한다. 카카오 개발자 콘솔에는 아래 Redirect URI를 추가해야 한다.

```text
https://my-secretary-remote.vercel.app/api/auth/kakao/callback
http://localhost:3000/api/auth/kakao/callback
http://localhost:3001/api/auth/kakao/callback
```

Kakao Developer Console에서는 `카카오 로그인 > 일반`의 사용 설정과 OpenID Connect를 ON으로 두고, `카카오 로그인 > 동의항목`에서 `profile_nickname`을 사용 가능하게 둔다. 이메일 기반 사용자 식별이 꼭 필요해지면 Kakao Biz App 전환 후 `account_email`을 켜고 Supabase 기본 Kakao provider 흐름으로 되돌릴 수 있다.

네이버는 Supabase 기본 provider 목록에 없으므로 앱에서는 준비 중 버튼으로 표시한다. 나중에 커스텀 OAuth/OIDC 또는 별도 인증 중계 서버를 붙이는 방식으로 확장한다.
