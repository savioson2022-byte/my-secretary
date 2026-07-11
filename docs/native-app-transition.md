# 네이티브 앱 전환 계획

## 목표

나의 비서를 웹 바로가기보다 실제 앱에 가깝게 만든다.

- iPhone에서 안정적인 푸시 알림과 소리/진동 알림을 받는다.
- Apple Watch에는 iPhone 알림 미러링으로 먼저 대응한다.
- 음성 기록은 앱 실행 후 바로 시작하거나 Siri/Shortcuts/Action Button으로 시작한다.
- 일정, 미확정 단기일정, 즉시처리 요청을 아침/저녁에 다시 확인한다.

## iOS 버튼 제어 현실성

iOS 앱은 전원 버튼 두 번, 볼륨 버튼 세 번 같은 물리 버튼 조합을 임의로 가로채기 어렵다.
대신 아래 경로가 현실적이다.

1. Action Button: iPhone 15 Pro 이상에서 단축어 실행
2. Siri/Shortcuts: "나의 비서 기록" 같은 음성 명령
3. 홈 화면 위젯: 바로 음성 기록 화면 열기
4. 잠금화면 위젯: 빠른 기록 진입
5. 앱 푸시 알림 액션: "확정하기", "나중에", "음성으로 답하기" 같은 버튼

## 추천 기술 선택

### 1차: 현재 Next.js 앱을 Capacitor로 감싸기

- 장점: 현재 UI와 Supabase/OpenAI 로직을 최대한 재사용한다.
- 단점: 완전한 네이티브 UX는 제한적이다.
- 적합한 작업: 푸시 알림, 앱 아이콘, 스플래시, 딥링크, 단축어 URL 진입.

### 2차: React Native/Expo 앱으로 핵심 화면 재작성

- 장점: 알림, 위젯, App Intents, Watch 연동으로 확장하기 좋다.
- 단점: 현재 웹 UI를 상당 부분 다시 구현해야 한다.
- 적합한 작업: 장기적으로 매일 쓰는 진짜 앱.

## 앱 전환 전 UI 정리

이번 정리 방향:

- 분류 기준은 `단기일정`, `메모`, `즉시처리` 세 가지로 단순화한다.
- 정기일정은 사용자가 일정관리에서 직접 수정한다.
- 구매/예약/연락은 즉시처리 안에서 에이전트 준비로 다룬다.
- 미확정 단기일정과 즉시처리는 아침/저녁 알림으로 다시 확인한다.
- 사용자가 바쁜 기간에는 미확정 알림을 멈출 수 있다.

## 다음 개발 순서

1. Capacitor 설치 및 iOS 프로젝트 생성
2. 앱 URL 스킴 추가: `mysecretary://voice`, `mysecretary://today`
3. 푸시 알림 인증서/APNs 설정
4. 알림 액션 추가: 확정, 나중에, 알림 멈춤
5. Siri Shortcuts/App Intents 추가
6. 잠금화면/홈화면 위젯 추가
7. Apple Watch는 우선 iPhone 알림 미러링으로 검증

## 현재 반영된 내용

- Capacitor 기반 iOS 프로젝트를 생성했다.
- 앱 이름은 `나의 비서`, 번들 식별자는 `app.mysecretary.mobile`로 준비했다.
- 앱 URL 스킴은 `mysecretary://`, `my-secretary://`를 등록했다.
- iOS 홈 화면 아이콘 길게 누르기용 빠른 동작을 추가했다.
  - 음성 기록
  - 오늘 일정
  - 설정
- 빠른 동작과 URL 스킴이 실제 웹뷰 경로로 이동하도록 AppDelegate에 연결했다.
  - `mysecretary://voice` -> `/?voice=1`
  - `mysecretary://today` -> `/`
  - `mysecretary://settings` -> `/settings`
- 웹앱 안에 `/app` 페이지를 추가해 TestFlight, App Store Connect, 음성 기록 단축어 설정 흐름을 안내한다.

## 2026-07-11 검증 기록

- Xcode 설치 후 iOS 26.5 시뮬레이터 런타임을 설치했다.
- `iPhone 17` 시뮬레이터 대상으로 Debug 빌드를 성공했다.
- 시뮬레이터에 `나의 비서` 앱을 설치하고 실행했다.
- `mysecretary://voice` URL 스킴이 iOS에서 앱 열기 확인창을 띄우는 것을 확인했다.
- Swift Package 의존성은 `Package.resolved`에 고정했다.
- 실제 iOS 기기용 SDK 컴파일을 확인했다.
  - `CODE_SIGNING_ALLOWED=NO` 상태의 generic iOS Debug 빌드 성공
  - `CODE_SIGNING_ALLOWED=NO` 상태의 Release Archive 성공
- 서명 포함 빌드는 Development Team이 없어 실패했다.
  - Xcode 오류: `Signing for "App" requires a development team.`
  - 키체인 확인 결과 Apple 개발 서명 인증서 0개
  - 로컬 프로비저닝 프로파일 없음
- 따라서 현재 남은 작업은 코드 수정이 아니라 Apple Developer Team 연결이다.

## App Store 또는 TestFlight 배포 순서

1. Mac에서 `npm run ios:open`으로 Xcode 프로젝트를 연다.
2. Xcode의 Signing & Capabilities에서 Apple Developer Team을 선택한다.
3. Bundle Identifier가 Apple Developer 계정에서 사용 가능한지 확인한다.
4. 실제 iPhone을 연결해 알림, 음성 기록, 로그인, 일정 동기화를 먼저 테스트한다.
5. Xcode에서 Archive를 만든다.
6. Distribute App으로 App Store Connect에 업로드한다.
7. TestFlight에서 내부 테스트를 먼저 진행한다.
8. 외부 사용자 테스트가 필요하면 Apple의 베타 앱 심사를 거쳐 공개 링크를 만든다.
9. 일주일 실사용 후 App Store 심사용 스크린샷, 설명, 개인정보 처리 항목을 정리한다.

## 외부 프로그램 다운로드 방식이 어려운 이유

iPhone은 일반 웹사이트에서 내려받은 앱 파일을 바로 설치하는 사용 흐름이 안정적이지 않다.
지인에게 테스트 앱을 배포하려면 TestFlight가 가장 현실적이고, 일반 사용자에게 배포하려면 App Store 심사가 필요하다.
