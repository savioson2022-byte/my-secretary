# 저장소 분류

현재 앱은 사용자 경험을 유지하기 위해 localStorage를 기본 저장소로 사용한다.
Supabase 전환을 쉽게 하기 위해 저장소 키와 대상 테이블을 분리해서 관리한다.
코드에서는 `src/lib/storageCatalog.ts`가 도메인, localStorage key, Supabase
대상 테이블, 이전 우선순위를 한 곳에서 관리한다.

## 현재 사용 중인 저장소

| 도메인 | localStorage key | Supabase 대상 |
| --- | --- | --- |
| 저장된 기록 | `my-assistant-items` | `assistant_items` |
| 정기 일정 | `my-assistant-routine-schedules` | `routine_schedules` |
| 단기 일정 | `my-assistant-single-schedules` | `single_schedules` |
| 저장 장소 | `my-assistant-saved-places` | `places` |
| 이동시간 규칙 | `my-assistant-travel-time-rules` | `travel_time_rules` |
| 이동시간 API 캐시 | `my-assistant-travel-time-estimates` | `travel_time_estimates` |
| 임시 사용자 프로필 | `my-assistant-user-profile` | `profiles` |
| 음성 입력 방식 | `my-assistant-voice-control-mode` | 사용자 설정 또는 기기 설정 |

## 레거시 저장소

`src/lib/coreStorage.ts`는 이전 구조에서 쓰던 저장소 키를 보존한다.
현재 주요 화면은 `storage.ts`, `routineStorage.ts`, `singleScheduleStorage.ts`,
`placeStorage.ts`, `travelTimeStorage.ts`를 사용한다.

## Supabase 전환 순서

1. `profiles`, `devices`를 먼저 DB 기반으로 안정화한다.
2. `places`를 DB 기반으로 전환한다. 장소는 이동시간 계산의 기반 데이터다.
3. `routine_schedules`, `single_schedules`를 DB 기반으로 전환한다.
4. `assistant_items`를 DB 기반으로 전환한다.
5. localStorage 데이터를 읽어 Supabase로 복사하는 1회 마이그레이션 버튼을 만든다.
6. 모든 저장소 함수는 같은 이름을 유지하고 내부 구현만 Supabase로 교체한다.

## 임시 데이터 이전

DB 저장소 전환 전까지는 브라우저 localStorage가 기기마다 분리된다.
모바일 테스트 중 데이터를 옮길 수 있도록 `/account` 페이지에 로컬 데이터
백업/가져오기 패널을 둔다.

이 패널은 `src/lib/storageCatalog.ts`의 저장소 목록을 기준으로 백업 파일을
만들고 다시 가져온다. Supabase 저장소 전환 후에는 같은 위치를 "DB로
마이그레이션" 버튼으로 교체한다.

## 전환 우선순위

| 우선순위 | 도메인 | 이유 |
| --- | --- | --- |
| first | 사용자 프로필과 AI 분류 기준 | 로그인 사용자 기준과 주 이동수단의 기준점이다. |
| early | 저장 장소 | 이동시간 계산과 일정 위치 연결의 기반이다. |
| middle | 정기 일정, 단기 일정, 저장된 기록 | 캘린더와 기록의 핵심 데이터다. |
| late | 이동시간 규칙, 이동시간 API 캐시, 음성 입력 방식 | 핵심 저장소 이후 안정화한다. |

## 이동시간 관련 저장 전략

사용자의 주 이동수단은 `profiles.preferred_travel_mode`에 저장한다.
장소는 실제 주소를 기본으로 저장하고, 카카오/네이버/TMAP 같은 API를 붙일 때
`provider`, `providerPlaceId`, `latitude`, `longitude`를 채운다.

이동시간은 일정과 다음 일정의 장소가 다르고, 두 일정 사이 여유가 30분 이하일
때만 자동 계산 대상으로 삼는다. 같은 `출발 장소 + 출발 시각 + 도착 장소 +
이동수단` 조합은 저장된 `travel_time_estimates` 값을 다시 사용한다.
