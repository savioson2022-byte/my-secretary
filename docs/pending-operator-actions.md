# 사용자가 돌아오면 승인/설정할 일

작업 중 외부 권한이나 계정 콘솔 설정이 필요한 일은 여기 모아둔다.

## GitHub

- 최신 작업은 `main` 브랜치에 커밋하고 GitHub 원격 저장소로 푸시했다.
- 마지막 기능 커밋: `Improve mobile account and travel time flow`

## 모바일 로컬 테스트

- 현재 Mac의 Wi-Fi 주소는 `172.30.1.84`다.
- iPhone에서 열 주소는 `http://172.30.1.84:3001/`다.
- 음성 기록 바로 진입 주소는 `http://172.30.1.84:3001/?voice=1`다.
- 단, 개발 서버가 네트워크 공개 모드로 실행되어야 하므로 필요하면 아래 방식으로 서버를 다시 띄운다.

```bash
npm run dev -- -H 0.0.0.0 -p 3001
```

- 자세한 절차는 `docs/mobile-local-test.md`를 참고한다.

## Supabase Auth Providers

앱에는 소셜 로그인 버튼이 추가되어 있다. 실제 사용하려면 Supabase Dashboard에서 각 provider를 켜야 한다.

- Google
- Apple
- Kakao

각 provider 콘솔에서 Client ID/Secret을 발급하고 Supabase Authentication > Providers에 등록한다.

Kakao는 `account_email` 권한이 없으면 Supabase 기본 OAuth에서 `KOE205`가 날 수 있다. 현재 앱은 카카오 OIDC 직접 로그인으로 우회하므로 Kakao Developers의 Redirect URI에 아래 값을 추가한다.

```text
https://my-secretary-remote.vercel.app/api/auth/kakao/callback
http://localhost:3000/api/auth/kakao/callback
http://localhost:3001/api/auth/kakao/callback
```

Kakao Developers에서 `카카오 로그인 > 일반 > OpenID Connect`는 ON이어야 한다.

네이버는 Supabase 기본 provider 목록에 없으므로 별도 커스텀 OAuth/OIDC 또는 인증 중계 서버가 필요하다.

## 대중교통 API

대중교통 이동시간 자동 계산은 아래 환경변수가 있어야 실제 호출된다.

```text
KAKAO_REST_API_KEY=
ODSAY_API_KEY=
```

키가 없으면 앱은 캐시를 확인한 뒤 "설정 필요" 메시지를 보여주고 기존 기능은 계속 동작한다.

## 배포 환경

Vercel 또는 배포 환경에도 아래 값을 추가해야 한다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `KAKAO_REST_API_KEY`
- `ODSAY_API_KEY`

## Web Push 알림

코드에는 Web Push 구독 저장, service worker, 5분 단위 발송 엔드포인트가 추가되어 있다.
실제로 앱이 꺼진 상태에서도 서버 푸시가 오게 하려면 아래 두 가지가 필요하다.

1. Supabase SQL Editor에서 아래 마이그레이션을 실행한다.

```text
supabase/migrations/20260704000000_create_push_notifications.sql
```

2. Supabase Project Settings > API에서 service role key를 확인한 뒤 Vercel Production 환경변수에 추가한다.

```text
SUPABASE_SERVICE_ROLE_KEY=
```

이미 Vercel Production에 추가한 값:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `CRON_SECRET`

`SUPABASE_SERVICE_ROLE_KEY`가 없으면 사용자가 푸시 구독을 저장할 수는 있어도,
Vercel Cron이 모든 사용자의 알림 일정을 읽어 실제 푸시를 발송할 수 없다.

추가 제한:

- 현재 Vercel Hobby 플랜은 5분 단위 Cron을 허용하지 않는다.
- 그래서 `/api/push/dispatch` 엔드포인트는 코드에 만들어두었지만 Vercel 내장 Cron 설정은 배포에서 제외했다.
- 실제 운영 발송을 하려면 둘 중 하나가 필요하다.
  - Vercel Pro로 올리고 5분 단위 Cron을 설정한다.
  - `cron-job.org` 같은 외부 스케줄러에서 5분마다 `https://my-secretary-remote.vercel.app/api/push/dispatch`를 호출하고 `Authorization: Bearer CRON_SECRET` 헤더를 넣는다.
