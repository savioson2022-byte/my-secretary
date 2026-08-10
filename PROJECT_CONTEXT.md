# 나의 비서 — 압축 컨텍스트

최종 정리: 2026-08-03 (Asia/Seoul)

이 문서는 새 Codex 작업이나 컨텍스트 압축 후 프로젝트를 즉시 이어가기 위한 기준 문서다. 실제 비밀키·토큰·비밀번호 값은 의도적으로 기록하지 않는다.

## 1. 프로젝트와 운영 위치

- 프로젝트: 나의 비서(My Secretary)
- 로컬 경로: `/Users/choee/Documents/나의 비서`
- GitHub: `savioson2022-byte/my-secretary`
- 기준 브랜치: `main`
- 기술: Next.js 14, React, TypeScript, Tailwind CSS, Supabase, Vercel, Capacitor iOS
- 운영 URL: `https://my-secretary-remote.vercel.app`
- Supabase project ref: `fesrtvxmqalkispmmhro`
- iOS Bundle ID: `app.mysecretary.mobile`
- Apple Team ID: `75H8G82657`
- App Store Connect App ID: `6796000691`
- iOS 버전/빌드: `1.0 (3)`

## 2. 최우선 작업 원칙

1. 기존 기능을 깨뜨리지 않는다.
2. 대규모 리팩터링보다 좁고 안정적인 수정을 우선한다.
3. 기능 단위로 타입 검사, lint, 프로덕션 빌드, 실제 동작을 확인한다.
4. 오류는 임시 우회하지 말고 원인을 수정한다.
5. `.env*`, 서비스 역할 키, OAuth secret, APNs/VAPID private key, 암호화 키 원문을 Git이나 문서에 넣지 않는다.
6. 사용자 소유 파일 `ios/App/App/config 2.xml`은 출처가 확인될 때까지 수정·삭제·커밋하지 않는다.
7. `npm run ios:sync` 후 `ios/App/App/capacitor.config.json`의 `packageClassList`에서 `AlarmPulsePlugin`이 지워지지 않았는지 반드시 확인한다.

## 3. 구현 완료 상태

### 입력·분류·승인

- 음성 인식 종료 시 원문 초안을 자동 저장한다.
- 초안 저장 후 AI가 간단히 자동 분류한다.
- 사용자가 분류 결과를 수정한 뒤 승인·저장할 수 있다.
- 승인 전/승인 완료 기록을 분리해 확인할 수 있다.
- OpenAI로 시작하고 승인·수정 사례가 쌓이면 기기 내 Gemma를 병행 평가한 뒤 기준 충족 시 우선 사용한다.
- Gemma의 개인화는 모델 재학습이 아니라 수정 기록을 컨텍스트 메모리로 반영하는 구조다.

### 일정·장소·시간작업

- 단기 일정과 메모 저장, 중복 저장 방지, 저장 실패 메시지가 구현돼 있다.
- 자정을 넘는 일정(예: 23:00~01:00)을 다음 날 종료로 처리한다.
- 단기 일정·시간작업 등에 등록 장소 또는 `장소 상관없음`을 지정할 수 있다.
- 단기 일정 수정 중 장소 변경 저장 문제를 수정했다.
- 기간형 시간작업의 시작일·마감일·분량·단위·총시간·회당시간 입력, 빈 시간 분배, 캘린더 저장, 완료 처리가 구현돼 있다.

### 알림

- 브라우저 푸시, APNs 네이티브 푸시, 로컬 알림, 앱 내부 지속 알람이 구현돼 있다.
- 사용자가 확인할 때까지 앱 내부에서 반복되는 강한 알람과 끄기·다시 알림 흐름이 있다.
- 장소 및 이동시간을 반영한 반응형 출발 알림이 있다.
- 다음 일정 3시간 전부터 30분 단위로 현재 위치를 확인하고, `실제 남은 시간 - 예상 이동시간 <= 30분`일 때 출발 알림을 보낸다.
- 이동수단은 사용자 기본값과 경로별 수정·학습 기록을 참고한다.
- PWA/브라우저 종료 상태에서는 위치 확인과 지속 음향을 보장할 수 없으며, Critical Alerts는 Apple 별도 승인이 필요하다.

### 계정·보안·개인정보

- 이메일/아이디 로그인과 네이티브 Sign in with Apple이 구현돼 있다.
- Apple App ID capability와 Supabase Apple provider가 활성화돼 있다.
- Apple 로그인은 iOS 네이티브 ID token + nonce 방식이며 웹 OAuth secret은 사용하지 않는다.
- 앱 내부 계정 삭제 기능과 개인정보처리방침·지원 페이지가 있다.
- 외부 AI 전송 전 명시적 동의를 받는다.
- 동의 대상: 일정·작업·메모, 개인화 기준, 연결된 구매 메일의 주문 관련 제목·본문.
- 비밀번호, 인증 토큰, 앱 비밀번호, 전체 메일함은 OpenAI로 보내지 않는다.
- 거부·철회 시 규칙 기반 기능과 기기 내 Gemma는 계속 사용할 수 있다.
- 서버 AI API와 구매 메일 cron도 `ai_data_consents`의 유효한 동의가 없으면 처리하지 않는다.
- Gmail/Naver 인증정보는 서버에서 암호화해 저장한다.
- 토큰 암호화는 현재 키와 이전 키를 지원해 점진적으로 재암호화한다.

### App Store 대응

- placeholder iOS 아이콘을 정식 1024×1024 무알파 아이콘으로 교체했다.
- Sign in with Apple을 추가했다.
- 외부 AI 데이터 전송 고지·명시적 동의·철회를 추가했다.
- iOS Build 3 아카이브 및 App Store Connect 업로드가 성공했다.
- 마지막 확인 시 Build 3은 Apple 처리 중이었으므로, 현재 상태를 App Store Connect에서 다시 확인해야 한다.

## 4. 최근 핵심 커밋

- `23f24e5` — iOS 빌드 번호 3
- `9565356` — 외부 AI 처리 전 동의 및 서버 차단
- `6ef71bb` — 네이티브 Sign in with Apple
- `d27de18` — iOS placeholder 아이콘 교체
- `f212722` — 토큰 암호화 키 안전한 회전
- `97b8e04` — iOS 암호화 수출 규정 선언
- `12d25e8` — App Store 개인정보 및 계정 삭제
- `3044cf0` — 구매 메일 인증정보 보안 강화

## 5. 최근 검증 결과

- `npm run test:token-encryption`: 18/18 통과
- `npx tsc --noEmit`: 통과
- `npm run lint`: 오류 없음. 기존 React Hook 의존성 경고 10개 존재
- `npm run build`: 성공, 54개 앱 경로 생성
- iOS Release 일반 빌드: 성공
- iOS Build 3 서명 아카이브: 성공
- App Store Connect 업로드: `UPLOAD SUCCEEDED with no errors`
- Vercel production: `READY`
- 운영 `/privacy`: HTTP 200
- 동의 없는 운영 `/api/classify`: HTTP 403
- Supabase `ai_data_consents` 테이블과 RLS: 원격 적용 완료

## 6. 주요 변경 파일 지도

### Apple 로그인

- `ios/App/App/AppleSignInPlugin.swift`
- `ios/App/App/MySecretaryBridgeViewController.swift`
- `ios/App/App/App.entitlements`
- `ios/App/App.xcodeproj/project.pbxproj`
- `src/lib/appleSignIn.ts`
- `src/components/AccountManager.tsx`

### AI 개인정보 동의

- `src/lib/aiDataConsent.ts`
- `src/lib/serverAiDataConsent.ts`
- `src/components/AiDataConsentGate.tsx`
- `src/components/AiDataConsentSettingsCard.tsx`
- `src/app/privacy/page.tsx`
- `supabase/migrations/20260801000000_create_ai_data_consents.sql`
- 보호 대상 API: `classify`, `ideas/group`, `purchase/import`, `purchase/mail/sync`, `purchase/mail/cron`

### 보안

- `src/lib/tokenEncryption.ts`
- `scripts/test-token-encryption.mjs`
- `src/lib/gmailPurchaseSync.ts`
- `src/lib/naverPurchaseSync.ts`

### 후속 작업 목록

- `docs/incomplete-features.md`

## 7. 바로 이어서 할 일

1. App Store Connect에 로그인하고 Build 3 처리 완료 여부를 확인한다.
2. Build 3을 iOS 1.0 버전에 선택한다.
3. 실제 iPhone에서 아래를 확인한다.
   - Apple 최초 로그인, 이메일 가리기, 재로그인, 로그아웃 후 재로그인
   - 외부 AI 동의/거부/철회/재동의
   - 거부·철회 후 fallback 분류 및 구매 메일 자동 분석 중단
   - 새 앱 아이콘 표시
4. 심사 메모에 세 거부 사유별 수정 위치와 테스트 방법을 작성한다.
5. 개인정보 수집 항목을 실제 구현과 대조해 App Store 개인정보 설문을 갱신한다.
6. 새 Build 3으로 재심사를 제출한다.

## 8. 미완성·제약 사항

- 별도로 생성된 Apple/이메일 계정을 사용자가 직접 합치는 통합계정 UI는 미완성이다.
- 지원 페이지의 일반 문의 접수 채널은 준비 중이다.
- Apple 로그인은 iOS 네이티브에서만 지원한다.
- 백그라운드 위치 확인과 강한 알람은 OS 정책의 영향을 받는다.
- Gmail/Naver, Kakao/ODsay, APNs/Web Push는 운영 환경변수와 외부 제공자 상태에 의존한다.
- 핵심 흐름의 E2E 테스트가 부족하다.
- 상세 목록은 `docs/incomplete-features.md`를 참고한다.

## 9. 표준 검증 순서

```bash
git status --short
npm run test:token-encryption
npm run lint
npm run build
npx tsc --noEmit
git diff --check
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

`npm run build`와 `npx tsc --noEmit`을 동시에 실행하면 `.next/types` 생성·삭제가 충돌해 거짓 TS6053 오류가 날 수 있으므로 순차 실행한다.

## 10. 완료 보고 형식

- 변경된 파일
- 구현 내용
- 테스트 결과
- 빌드 성공 여부
- 커밋 해시
- GitHub Push 여부
- Vercel 배포 여부
- Supabase 원격 적용 여부
- App Store Connect 업로드·처리·재심사 상태
