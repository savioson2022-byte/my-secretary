# 나의 비서 Android 출시 준비

작성일: 2026-08-13

## 현재 완료된 작업

- Capacitor Android 프로젝트 생성 (`android/`)
- 앱 ID `app.mysecretary.mobile`, 앱 이름 `나의 비서` 적용
- Android 7.0(API 24) 이상, target/compile SDK 36 설정
- 위치, 진동, Android 13 이상 알림 권한 선언
- 중요도 높은 `assistant_reminders` 알림 채널 생성
- `mysecretary://voice`, `today`, `settings`, `auth` 딥링크 연결
- 앱 아이콘 길게 누르기 빠른 동작 3종 추가
- 네이티브 푸시 토큰을 iOS/Android로 구분해 저장
- Firebase Cloud Messaging HTTP v1 서버 발송 구현
- Android 동기화 명령 추가: `npm run android:sync`, `npm run android:open`

## 로컬 실행 준비

1. Android Studio 최신 안정 버전과 JDK 21을 설치한다.
2. Android Studio SDK Manager에서 Android SDK 36과 빌드 도구를 설치한다.
3. 프로젝트 루트에서 `npm install` 후 `npm run android:sync`를 실행한다.
4. `npm run android:open`으로 Android Studio를 연다.
5. 에뮬레이터 또는 USB 디버깅을 켠 실제 기기에서 실행한다.

이 앱은 원격 웹앱(`https://my-secretary-remote.vercel.app`)을 WebView로 표시하므로, 인터넷 연결과 배포 서버가 필요하다.

## Firebase/FCM 설정

1. Firebase Console에서 Android 앱을 추가한다.
2. 패키지 이름은 `app.mysecretary.mobile`로 입력한다.
3. 내려받은 `google-services.json`을 `android/app/google-services.json`에 둔다. 이 파일은 저장소에 커밋하지 않는다.
4. Firebase 서비스 계정을 만들고 서버 배포 환경에 아래 값을 등록한다.

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

개인 키의 줄바꿈은 `\\n` 형태로 저장해도 서버에서 복원한다.

## 실제 기기 필수 점검

- 이메일/카카오 로그인 후 앱으로 세션 복귀
- 음성 입력 및 마이크 권한
- 현재 위치 권한과 이동시간 알림
- 로컬 알림 예약, 소리, 진동
- FCM 원격 푸시 수신 및 알림 탭 이동
- `mysecretary://voice`, `mysecretary://settings` 실행
- 앱 종료/백그라운드/절전 모드 각각에서 알림 동작
- 화면 크기와 글자 확대 설정별 UI
- 계정 삭제, 개인정보 처리방침, 고객지원 링크

## Google Play 출시 순서

1. Play Console 개발자 계정을 준비한다.
2. 앱을 만들고 개인정보 처리방침, 데이터 보안 양식, 콘텐츠 등급을 작성한다.
3. Android Studio에서 업로드 키를 생성하고 서명된 AAB를 만든다.
4. 내부 테스트 트랙에 AAB를 올려 실제 기기 테스트를 진행한다.
5. 비공개/공개 테스트 요구사항이 계정에 표시되면 이를 완료한다.
6. 스토어 설명, 휴대전화 스크린샷, 512px 아이콘, 기능 그래픽을 등록한다.
7. 프로덕션 출시 심사를 요청한다.

## 아직 외부 설정이 필요한 항목

- Android Studio/JDK/SDK 설치 및 APK/AAB 빌드
- Firebase 프로젝트 및 `google-services.json`
- 서버의 Firebase 서비스 계정 환경변수
- Play App Signing용 업로드 키(안전한 별도 보관 필요)
- Play Console 등록 정보와 정책 설문

## 검증 기록

- `npx cap sync android`: 성공
- `npm run build`: 성공
- 기존 React Hook lint 경고는 남아 있으나 Android 변경과 무관하며 빌드를 막지 않음
- 현재 작업 Mac에는 Java Runtime이 없어 Gradle 네이티브 빌드는 수행하지 못함
