# 사용자가 돌아오면 승인/설정할 일

작업 중 외부 권한이나 계정 콘솔 설정이 필요한 일은 여기 모아둔다.

## GitHub

- 현재 변경사항은 로컬에 준비되어 있다.
- Codex에서 자동 커밋/푸시가 사용량 제한으로 막히면 GitHub Desktop에서 직접 커밋/푸시한다.
- 추천 커밋 메시지: `Add social auth UI and transit travel cache`

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
