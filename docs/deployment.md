# Vercel 배포와 iPhone 설치 준비

## 목표

이 앱을 Mac 로컬 주소가 아니라 iPhone에서 접근 가능한 HTTPS 주소로 배포한다. 배포 후 홈 화면에 추가하고, `/?voice=1` 주소를 iPhone 단축어/동작 버튼/뒷면 탭과 연결해 음성 기록 진입을 빠르게 만든다.

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

## Vercel 배포 순서

1. GitHub Desktop에서 최신 커밋을 `Push origin` 한다.
2. Vercel에 로그인한다.
3. `Add New Project`를 선택한다.
4. GitHub 저장소 `savioson2022-byte/my-secretary`를 import 한다.
5. Framework Preset은 `Next.js`로 둔다.
6. Build Command는 기본값 `next build`를 사용한다.
7. Environment Variables에 다음 값을 추가한다.

```text
OPENAI_API_KEY=실제 OpenAI API 키
```

8. Deploy를 누른다.

## 배포 후 확인

배포 URL에서 아래 경로를 확인한다.

```text
/
/?voice=1
/calendar/monthly
/calendar/weekly
/calendar/single
/manifest.webmanifest
```

`/?voice=1`에서 마이크 버튼을 눌렀을 때 브라우저가 마이크 권한을 요청하면 허용한다.

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
https://your-deployment.vercel.app/?voice=1
```

5. 단축어 이름을 `나의 비서 음성 기록`으로 저장한다.
6. 필요하면 동작 버튼, 뒷면 탭, 홈 화면 아이콘, Siri 문구에 연결한다.

## Apple Watch 방향

웹앱이 Apple Watch의 물리 버튼을 직접 제어할 수는 없다. 현실적인 1차 방향은 Apple Watch에서 Siri 또는 단축어를 실행해 iPhone의 배포 URL을 여는 것이다.

장기적으로는 Apple Watch 단축어가 받아쓴 텍스트를 서버 API로 보내고, 서버 DB에 바로 저장하는 별도 엔드포인트를 만들 수 있다.

## 다음 단계

Vercel 배포가 끝나면 Supabase 저장소 전환을 준비한다. localStorage는 현재 기기 안에만 남기 때문에, iPhone과 Mac이 같은 기록을 보려면 서버 DB가 필요하다.
