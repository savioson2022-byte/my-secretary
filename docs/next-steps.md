# 나의 비서 MVP 다음 개발 순서

이 문서는 Supabase, PWA, Web Push로 확장하기 전에 현재 MVP를 안전하게 발전시키기 위한 실행 순서다. 지금 단계에서는 기능을 크게 바꾸기보다 저장 경계와 데이터 구조를 먼저 안정화한다.

## 1단계: localStorage storage layer 정리

목표: 현재 브라우저 저장소에 직접 붙어 있는 함수들을 나중에 DB 구현으로 바꾸기 쉬운 형태로 정리한다.

진행 상태: `src/lib/localStorageRepository.ts`에 공통 localStorage 배열 저장소 유틸을 추가했고, 현재 사용하는 기록/정기 일정/단기 일정 저장 함수는 기존 공개 함수명을 유지한 채 이 공통 레이어를 사용한다.

권장 작업:

- `storage.ts`, `routineStorage.ts`, `singleScheduleStorage.ts`, `coreStorage.ts`의 역할을 정리한다.
- 현재 실제 화면에서 쓰는 저장소와 향후 모델 후보 저장소를 구분한다.
- 저장소 함수 이름을 도메인 기준으로 맞춘다.
  - 기록: `assistantItems`
  - 정기 일정: `routineSchedules`
  - 단기 일정: `singleSchedules`
- 각 저장소에 공통 CRUD 인터페이스를 만든다.
  - `list`
  - `create`
  - `update`
  - `delete`
  - 필요 시 `findByDate`, `findBySourceItemId`
- `window.localStorage` 접근은 저장소 파일 내부에만 남긴다.
- 컴포넌트는 `localStorage` 키를 몰라도 되게 유지한다.
- 단기 일정 변경 이벤트인 `single-schedules-updated`는 임시로 유지하되, 나중에 서버 상태 관리로 교체할 수 있게 호출 위치를 모은다.

완료 기준:

- 화면 컴포넌트가 저장 방식에 직접 의존하지 않는다.
- 저장소 파일을 DB 구현으로 바꾸더라도 페이지와 컴포넌트 수정 범위가 작다.
- 기존 localStorage 데이터 키는 유지해서 현재 사용자의 데이터가 갑자기 사라지지 않는다.

주의:

- 이 단계에서는 Supabase를 설치하지 않는다.
- 기존 데이터 키를 바로 바꾸지 않는다.
- 타입 이름을 대규모로 바꾸기보다 저장소 경계를 먼저 만든다.

## 2단계: Supabase 테이블 설계

목표: 현재 타입과 사용 흐름을 바탕으로 서버 DB 테이블을 설계한다.

권장 테이블:

- `profiles`
  - 사용자별 앱 설정과 기본 정보를 저장
- `assistant_items`
  - 현재 `AssistantItem`에 해당하는 일반 기록
- `routine_schedules`
  - 현재 `RoutineSchedule`에 해당하는 정기 일정
- `single_schedules`
  - 현재 `SingleSchedule`에 해당하는 단기 일정
- `places`
  - 위치를 정규화할 때 사용
- `travel_time_rules`
  - 장소 간 이동 시간 규칙
- `push_subscriptions`
  - Web Push 구독 정보
- `notification_jobs`
  - 발송 예정 알림 또는 발송 기록

먼저 필요한 최소 테이블:

- `assistant_items`
- `routine_schedules`
- `single_schedules`
- `push_subscriptions`

설계 원칙:

- 모든 사용자 데이터에는 `user_id`를 둔다.
- 모든 주요 테이블에는 `id`, `created_at`, `updated_at`을 둔다.
- 날짜는 `date`, 시간은 `time` 타입 사용을 우선 검토한다.
- 기존 TypeScript enum 값과 DB 체크 제약을 맞춘다.
- `single_schedules.source_item_id`는 `assistant_items.id`를 참조할 수 있게 설계한다.

완료 기준:

- 현재 localStorage 데이터가 어느 테이블로 옮겨질지 명확하다.
- 알림 구현에 필요한 날짜, 시간, 상태 필드가 빠지지 않는다.
- Row Level Security 정책을 설계할 수 있는 구조다.

## 3단계: Supabase client 추가

목표: 앱에서 Supabase를 사용할 수 있는 최소 연결 코드를 추가한다.

권장 작업:

- Supabase 패키지를 설치한다.
- `.env.local`에 Supabase URL과 anon key를 추가한다.
- 브라우저용 Supabase client 파일을 만든다.
- 서버에서 사용할 client가 필요하면 별도 파일로 분리한다.
- 인증을 바로 붙일지, 임시 단일 사용자 모드로 갈지 결정한다.

권장 파일 구조:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/repositories/`

완료 기준:

- 앱에서 Supabase client를 import할 수 있다.
- 환경변수가 없을 때 명확한 오류가 난다.
- 아직 기존 기능의 저장 방식은 바꾸지 않는다.

주의:

- 이 단계는 연결 준비만 한다.
- 데이터 저장을 즉시 DB로 갈아끼우지 않는다.

## 4단계: 저장소 함수를 DB 기반으로 교체

목표: 컴포넌트는 그대로 두고 저장소 구현만 localStorage에서 Supabase로 바꾼다.

권장 순서:

1. 읽기 함수부터 DB 기반으로 만든다.
2. 생성 함수의 DB 저장을 붙인다.
3. 수정과 삭제를 붙인다.
4. 단기 일정 자동 생성 흐름을 DB 트랜잭션 또는 안전한 순서로 정리한다.
5. 기존 localStorage 데이터 마이그레이션 버튼 또는 일회성 함수를 준비한다.

대상 함수:

- `getItems`, `saveItem`, `updateItem`, `deleteItem`
- `getRoutineSchedules`, `saveRoutineSchedule`, `deleteRoutineSchedule`
- `getSingleSchedules`, `saveSingleSchedule`, `updateSingleSchedule`, `deleteSingleSchedule`

완료 기준:

- 새로 저장한 기록이 Supabase에 남는다.
- 새로 저장한 단기 일정이 캘린더에 표시된다.
- 정기 일정과 단기 일정을 함께 고려한 빈 시간 계산이 계속 동작한다.
- 시간작업 추천이 DB에서 읽은 데이터로도 동일하게 동작한다.

주의:

- 한 번에 모든 저장소를 바꾸지 말고 기록, 단기 일정, 정기 일정 순서로 나눠서 바꾼다.
- 기존 localStorage fallback을 잠시 유지하면 전환 중 디버깅이 쉽다.

## 5단계: PWA manifest/service worker 준비

목표: 아이폰 홈 화면에 추가할 수 있는 설치형 웹앱 기반을 만든다.

권장 작업:

- `public/manifest.webmanifest`를 추가한다.
- 앱 이름, 짧은 이름, 시작 URL, 표시 모드, 테마 색상, 아이콘을 설정한다.
- `src/app/layout.tsx`에 manifest 메타데이터를 연결한다.
- iOS 홈 화면 아이콘과 상태바 관련 메타 태그를 점검한다.
- service worker 등록 전략을 정한다.

완료 기준:

- 모바일 브라우저에서 홈 화면 추가가 가능하다.
- 설치 후 독립 앱처럼 열리는지 확인한다.
- 아직 Push 구독은 붙이지 않아도 된다.

주의:

- App Router와 충돌하지 않게 service worker 파일 위치를 신중히 정한다.
- 캐싱 전략은 처음에는 보수적으로 잡는다.

## 6단계: Web Push 구독 저장

목표: 사용자의 브라우저 Push 구독 정보를 서버 DB에 저장한다.

권장 작업:

- VAPID key를 준비한다.
- 클라이언트에서 알림 권한 요청 UI를 만든다.
- service worker에서 Push 이벤트 수신 준비를 한다.
- Push 구독 객체를 Supabase의 `push_subscriptions` 테이블에 저장한다.
- 구독 갱신과 해제를 처리한다.

`push_subscriptions`에 필요한 필드:

- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `user_agent`
- `created_at`
- `updated_at`
- `revoked_at`

완료 기준:

- 사용자가 알림 권한을 허용하면 구독 정보가 DB에 저장된다.
- 같은 브라우저에서 중복 구독이 무한히 쌓이지 않는다.
- 알림 권한 거부 상태도 UI에서 알 수 있다.

주의:

- iOS Safari의 Web Push 제약을 별도로 확인한다.
- 애플워치 알림은 웹앱이 직접 워치로 보내는 것이 아니라, 아이폰 알림 미러링에 의존하는 흐름이다.

## 7단계: 알림 스케줄러 구현

목표: 저장된 일정과 리마인더를 기준으로 정해진 시간에 Web Push 알림을 보낸다.

권장 작업:

- 알림 대상 규칙을 정한다.
  - 단기 일정 시작 전 알림
  - `reminderDate` 알림
  - 마감일 당일 알림
  - 정기 일정 시작 전 알림
- `notification_jobs` 테이블을 만든다.
- 일정 저장 또는 수정 시 알림 작업을 생성/갱신한다.
- 서버에서 주기적으로 발송할 스케줄러를 구성한다.
- 발송 성공, 실패, 재시도 상태를 기록한다.

구현 후보:

- Supabase Edge Functions와 예약 실행
- 별도 서버 cron
- Vercel Cron

완료 기준:

- 단기 일정 또는 리마인더를 저장하면 발송 예정 알림이 생성된다.
- 예정 시간이 되면 Push 알림이 발송된다.
- 발송 결과가 DB에 기록된다.
- 아이폰에 알림이 오고, 아이폰 설정에 따라 애플워치로 미러링된다.

주의:

- 브라우저만으로 안정적인 예약 알림을 구현하려고 하면 앱이 닫혀 있을 때 한계가 있다.
- 알림 예약과 발송은 서버 측 스케줄러가 맡는 구조가 안전하다.

## 추천 작업 순서 요약

1. 현재 localStorage 함수 경계 정리
2. 현재 타입을 바탕으로 Supabase 테이블 초안 작성
3. Supabase client만 추가
4. 저장소 구현을 하나씩 DB로 교체
5. PWA 설치 기반 추가
6. Web Push 구독 저장
7. 서버 스케줄러로 알림 발송

이 순서대로 가면 앱의 핵심 기능을 유지하면서 저장 구조, 설치형 앱, 알림 기능을 단계적으로 붙일 수 있다.
