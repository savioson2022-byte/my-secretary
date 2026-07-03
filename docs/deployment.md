# Vercel 배포와 iPhone 설치 준비

## 현재 배포 URL

`나의 비서`는 Vercel Production에 배포되어 있다.

```text
https://my-secretary-remote.vercel.app
```

## Vercel 프로젝트

- Project: `my-secretary-remote`
- GitHub repository: `savioson2022-byte/my-secretary`
- Production alias: `my-secretary-remote.vercel.app`

## 현재 상태

- 배포 URL은 정상 응답한다.
- GitHub 저장소와 Vercel 프로젝트는 연결되어 있다.
- Vercel 환경변수는 아직 등록되지 않았다.

## 현재 준비된 것

- PWA manifest: `public/manifest.webmanifest`
- 앱 아이콘:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/icon-maskable-512.png`
  - `public/icons/apple-touch-icon.png`
- favicon: `public/favicon.svg`
- Next metadata manifest 연결: `src/app/layout.tsx`
- 음성 입력 진입 URL: `/?voice=1`

## Vercel 환경변수

Vercel Dashboard의 Project Settings > Environment Variables에 아래 값을
Production 환경으로 추가한 뒤 다시 배포한다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
KAKAO_REST_API_KEY
ODSAY_API_KEY
```

`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 없으면
배포 URL에서 Supabase 로그인과 기기 연결이 비활성화된다.

`OPENAI_API_KEY`가 없으면 AI 분류 대신 규칙 기반 분류로 fallback된다.

`KAKAO_REST_API_KEY`와 `ODSAY_API_KEY`가 없으면 대중교통 이동시간 자동
계산은 준비 메시지만 보여준다.

## 배포 후 확인

배포 URL에서 아래 경로를 확인한다.

```text
/
/?voice=1
/account
/calendar/monthly
/calendar/weekly
/calendar/single
/manifest.webmanifest
```

`/?voice=1`에서 마이크 버튼을 눌렀을 때 브라우저가 마이크 권한을 요청하면
허용한다.

## iPhone 홈 화면 추가

1. iPhone Safari에서 배포 URL을 연다.
2. 공유 버튼을 누른다.
3. `홈 화면에 추가`를 선택한다.
4. 이름을 `나의 비서`로 저장한다.

## iPhone 단축어 연결

1. 단축어 앱을 연다.
2. 새 단축어를 만든다.
3. `URL 열기` 동작을 추가한다.
4. URL에 배포 주소 뒤 `/?voice=1`을 붙여 입력한다.

예:

```text
https://my-secretary-remote.vercel.app/?voice=1
```

5. 단축어 이름을 `나의 비서 음성 기록`으로 저장한다.
6. 필요하면 동작 버튼, 뒷면 탭, 홈 화면 아이콘, Siri 문구에 연결한다.

## Apple Watch 방향

웹앱이 Apple Watch의 물리 버튼을 직접 제어할 수는 없다. 현실적인 1차
방향은 Apple Watch에서 Siri 또는 단축어를 실행해 iPhone의 배포 URL을 여는
것이다.

장기적으로는 Apple Watch 단축어가 받아쓴 텍스트를 서버 API로 보내고, 서버
DB에 바로 저장하는 별도 엔드포인트를 만들 수 있다.

## 다음 단계

Vercel 환경변수를 등록하고 재배포한다. 그 다음 Supabase 저장소 전환을
진행한다. localStorage는 현재 기기 안에만 남기 때문에, iPhone과 Mac이 같은
기록을 보려면 서버 DB가 필요하다.
