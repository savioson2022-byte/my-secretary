# 나의 비서 MVP 프로젝트 개요

이 문서는 현재 코드베이스를 기준으로 앱의 구조와 주요 흐름을 정리한 개발 준비 문서다. 아직 Supabase, PWA, Web Push는 구현하지 않고, 다음 단계에서 안전하게 확장하기 위한 기준점으로 사용한다.

## 현재 앱의 목적

`나의 비서`는 사용자가 떠오른 생각, 할 일, 일정, 아이디어를 빠르게 입력하면 AI가 내용을 분류하고, 사용자가 분류 결과를 확인하거나 수정한 뒤 저장할 수 있는 개인 AI 비서 웹앱 MVP다.

현재 저장은 서버 DB가 아니라 브라우저 `localStorage`를 사용한다. 앱 안에서는 일반 기록, 정기 일정, 단기 일정을 분리해서 관리하며, 주간 캘린더에서는 정기 일정과 단기 일정을 함께 고려해 빈 시간과 시간작업 추천을 계산한다.

## 현재 구현된 기능

- 짧은 텍스트 입력
- OpenAI API 기반 입력 분류
- OpenAI API 미설정 또는 실패 시 규칙 기반 분류 fallback
- 저장 전 분류 결과 수정
- 저장된 기록의 완료 처리와 삭제
- 상태 또는 카테고리 필터링
- 오늘 확인할 기록 표시
- 단기일정 자동 캘린더 등록
- 단기일정 목록 관리
- 월간 캘린더에서 단기일정 표시
- 주간 캘린더에서 정기 일정과 단기 일정 함께 표시
- 주간 캘린더에서 드래그로 정기 일정 시간 선택
- 정기 일정 추가와 삭제
- 정기 일정의 시작일, 종료일, 활성 여부 기반 표시
- 정기 일정과 단기 일정을 제외한 빈 시간 계산
- 시간작업을 빈 시간에 배치하는 추천
- `.ics` 캘린더 파일 생성 유틸리티

## 주요 데이터 타입

### AssistantItem

파일: `src/types/assistant.ts`

현재 메인 화면의 저장된 기록을 표현하는 핵심 타입이다.

- `originalText`: 사용자가 입력한 원문
- `title`: 화면에 보여줄 짧은 제목
- `category`: 업무, 학업, 건강, 생활/구매 등 분야
- `actionType`: 구매, 연락, 공부, 운동, 메모 등 행동 유형
- `processType`: 즉시처리, 시간작업, 단기일정, 정기시간표, 메모, 아이디어
- `priority`: 낮음, 보통, 높음
- `repeatType`: 일회성 또는 주기성
- `status`: 미완료, 완료, 보류
- `estimatedMinutes`: 예상 소요 시간
- `dueDate`: 마감일 또는 단기일정 날짜
- `reminderDate`: 다시 확인할 날짜
- `scheduleStartTime`, `scheduleEndTime`: 단기일정의 시작/종료 시간
- `id`, `createdAt`, `updatedAt`: 저장 후 부여되는 식별자와 시각

### RoutineSchedule

파일: `src/types/routine.ts`

반복되는 정기 일정을 표현한다.

- `dayOfWeek`: 월~일 중 반복 요일
- `startTime`, `endTime`: HH:mm 형식의 시작/종료 시간
- `placeName`: 위치
- `memo`: 메모
- `startDate`, `endDate`: 정기 일정 적용 기간. 제한이 없으면 `null`
- `isActive`: 현재 사용할 일정인지 여부

### SingleSchedule

파일: `src/types/calendar.ts`

한 번만 발생하는 단기 일정을 표현한다.

- `date`: YYYY-MM-DD 형식의 날짜
- `startTime`, `endTime`: HH:mm 형식의 시작/종료 시간
- `placeName`: 위치
- `memo`: 메모
- `sourceItemId`: 원본 `AssistantItem`과 연결하기 위한 ID. 직접 만든 일정이면 `null` 가능

### CalendarBusyBlock

파일: `src/types/calendar.ts`

캘린더에서 바쁜 시간을 공통 형태로 다룰 수 있게 만든 타입이다.

- `sourceType`: `routine` 또는 `single`
- `date`: 단기 일정 날짜
- `dayOfWeek`: 정기 일정 요일
- `startTime`, `endTime`: 바쁜 시간 범위

### Assistant Core 타입

파일: `src/types/assistant-core.ts`

`Place`, `ShortTermSchedule`, `TravelTimeRule`, `AssistantTask`, `ClassifiedInput` 등 더 정규화된 구조가 정의되어 있다. 현재 앱 전체가 이 타입으로 완전히 전환된 상태는 아니며, Supabase 전환 시 테이블 설계의 후보 모델로 볼 수 있다.

## localStorage 저장 데이터

현재 저장소 함수는 여러 파일로 분리되어 있다.

### `my-assistant-items`

파일: `src/lib/storage.ts`

메인 기록 `AssistantItem[]`을 저장한다.

- 사용 위치: 메인 페이지, 주간 캘린더의 시간작업 추천
- 주요 함수: `getItems`, `saveItem`, `updateItem`, `deleteItem`

### `my-assistant-routine-schedules`

파일: `src/lib/routineStorage.ts`

정기 일정 `RoutineSchedule[]`을 저장한다.

- 사용 위치: 주간 캘린더, 빈 시간 계산, 시간작업 추천
- 주요 함수: `getRoutineSchedules`, `saveRoutineSchedule`, `deleteRoutineSchedule`

### `my-assistant-single-schedules`

파일: `src/lib/singleScheduleStorage.ts`

단기 일정 `SingleSchedule[]`을 저장한다.

- 사용 위치: 월간 캘린더, 주간 캘린더, 단기 일정 페이지, 빈 시간 계산, 시간작업 추천
- 주요 함수: `getSingleSchedules`, `saveSingleSchedule`, `updateSingleSchedule`, `deleteSingleSchedule`, `getSingleSchedulesByDate`
- 변경 이벤트: `single-schedules-updated`

### `coreStorage.ts`의 준비용 키

파일: `src/lib/coreStorage.ts`

향후 정규화된 저장 구조를 위한 키들이 준비되어 있다.

- `my-assistant-places`
- `my-assistant-routines`
- `my-assistant-short-term-schedules`
- `my-assistant-travel-rules`
- `my-assistant-tasks`

현재 주요 화면은 기존 `storage.ts`, `routineStorage.ts`, `singleScheduleStorage.ts` 흐름을 중심으로 동작한다.

## 현재 페이지 구조

### `/`

파일: `src/app/page.tsx`

메인 입력 페이지다.

흐름:

1. 사용자가 텍스트를 입력한다.
2. `aiClassifyInput`으로 `/api/classify`에 분류 요청을 보낸다.
3. 실패하면 `classifyInput` 규칙 기반 분류를 사용한다.
4. 분류 결과를 `ClassificationResult`에서 수정할 수 있다.
5. 저장하면 `AssistantItem`으로 `my-assistant-items`에 저장한다.
6. 저장된 항목이 단기일정이고 날짜/시간이 있으면 `SingleSchedule`로 변환해 `my-assistant-single-schedules`에도 저장한다.

### `/calendar/monthly`

파일: `src/app/calendar/monthly/page.tsx`

월간 캘린더 페이지다. `getSingleSchedules`로 단기 일정을 읽고 `MonthlyCalendarView`에 전달한다. 단기 일정 변경 이벤트를 구독해 화면을 갱신한다.

### `/calendar/weekly`

파일: `src/app/calendar/weekly/page.tsx`

주간 캘린더 페이지다. 메인 기록을 읽어 `RoutineScheduleManager`로 전달한다. `RoutineScheduleManager` 안에서 정기 일정, 단기 일정, 빈 시간, 시간작업 추천을 함께 표시한다.

### `/calendar/single`

파일: `src/app/calendar/single/page.tsx`

단기 일정 관리 페이지다. 단기 일정 목록을 읽고 `SingleScheduleList`에서 수정/삭제할 수 있게 한다.

### `/api/classify`

파일: `src/app/api/classify/route.ts`

OpenAI API를 사용해 입력을 JSON Schema에 맞게 분류한다. `OPENAI_API_KEY`가 없거나 API 호출이 실패하면 `classifyInput`으로 fallback한다.

## AI 분류 흐름

1. 사용자가 메인 페이지에서 `handleClassify`를 실행한다.
2. 클라이언트 함수 `aiClassifyInput`이 `/api/classify`로 POST 요청을 보낸다.
3. API 라우트는 입력 텍스트가 비어 있으면 400을 반환한다.
4. `OPENAI_API_KEY`가 없으면 `classifyInput` 결과를 `source: "fallback"`으로 반환한다.
5. 키가 있으면 OpenAI Responses API에 JSON Schema 기반 분류를 요청한다.
6. 응답은 `normalizeResult`에서 보정된다.
   - 상태는 항상 `미완료`
   - 날짜와 알림 날짜가 없으면 `null`
   - 시간이 유효하지 않으면 `null`
   - 단기일정에 시작 시간만 있으면 예상 시간을 기준으로 종료 시간을 계산
7. OpenAI 호출 또는 파싱이 실패하면 `classifyInput` 결과를 fallback으로 반환한다.
8. 클라이언트에서도 API 요청 자체가 실패하면 다시 `classifyInput`을 사용한다.

## 캘린더 등록 흐름

1. 사용자가 분류 결과를 저장한다.
2. 메인 페이지에서 `AssistantItem`을 생성해 `saveItem`으로 저장한다.
3. `createSingleScheduleFromItem`을 호출한다.
4. 항목의 `processType`이 `단기일정`이 아니면 등록하지 않는다.
5. `dueDate`가 없으면 등록하지 않는다.
6. `scheduleStartTime`이 유효하면 사용하고, 없으면 원문에서 시간을 다시 탐지한다.
7. 종료 시간이 없으면 시작 시간과 예상 소요 시간을 바탕으로 계산한다. 예상 시간이 없으면 기본 60분을 사용한다.
8. 변환에 성공하면 `saveSingleSchedule`로 단기 일정 저장소에 추가한다.
9. `saveSingleSchedule`은 같은 `sourceItemId`가 이미 있으면 중복 저장하지 않는다.
10. 저장 후 `single-schedules-updated` 이벤트를 발생시켜 월간/단기/주간 관련 화면이 갱신될 수 있게 한다.

## 빈 시간 계산 흐름

파일: `src/lib/availability.ts`

1. 기준 날짜를 YYYY-MM-DD로 받는다.
2. 날짜에서 요일을 계산한다.
3. 정기 일정 중 해당 요일이고, 시작일/종료일/isActive 조건상 해당 날짜에 활성인 일정만 고른다.
4. 단기 일정 중 해당 날짜의 일정만 고른다.
5. 정기 일정과 단기 일정을 모두 `startMinutes`, `endMinutes` 형태의 바쁜 시간으로 변환한다.
6. 바쁜 시간들을 시작 시간 기준으로 정렬한다.
7. 겹치거나 맞닿은 바쁜 시간은 하나로 병합한다.
8. 하루 00:00~24:00 기준으로 바쁜 시간 사이의 남는 구간을 `FreeTimeBlock[]`으로 반환한다.

`WeeklyAvailabilityView`는 이번 주 7일에 대해 이 계산을 반복하고, 각 날짜별 빈 시간 목록을 보여준다.

## 시간작업 추천 흐름

파일: `src/lib/taskScheduleSuggestion.ts`

1. 저장된 기록 중 `status`가 `미완료`이고 `processType`이 `시간작업`인 항목만 추천 대상이다.
2. `estimatedMinutes`가 없으면 추천하지 않는다.
3. `dueDate`가 있으면 해당 날짜만 탐색한다.
4. `dueDate`가 없으면 오늘부터 14일 범위를 탐색한다.
5. 각 날짜마다 `calculateFreeTimeBlocksForDate`로 정기 일정과 단기 일정을 제외한 빈 시간을 계산한다.
6. 예상 소요 시간 이상인 첫 번째 빈 시간 블록을 찾는다.
7. 찾으면 시작 시간을 빈 시간의 시작으로 잡고, 종료 시간은 예상 소요 시간을 더해 계산한다.
8. 추천 사유에는 정기 일정과 단기 일정을 모두 제외한 추천이라는 설명이 포함된다.

## 앞으로 확장 추천 순서

1. localStorage storage layer 정리
2. Supabase 테이블 설계
3. Supabase client 추가
4. 저장소 함수를 DB 기반으로 교체
5. PWA manifest와 service worker 준비
6. Web Push 구독 저장
7. 알림 스케줄러 구현

이 순서가 좋은 이유는 저장 구조가 안정되어야 Supabase 테이블과 API 경계가 흔들리지 않고, DB에 일정과 알림 구독이 안정적으로 저장되어야 Web Push와 스케줄러를 붙일 수 있기 때문이다.
