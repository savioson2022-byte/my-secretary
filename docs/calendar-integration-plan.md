# 외부 캘린더 연동 설계 (1단계)

작성일: 2026-08-19

## 목표

앱에 일정을 하나도 입력하지 않은 계정에서도 `오늘 빈 시간`이 실제와 일치하게 만든다.

지금 `src/lib/calendar.ts`는 ICS 내보내기만 한다. 읽어오는 경로가 없으므로 `calculateFreeTimeBlocksForDate()`가 계산하는 빈 시간은 사용자의 실제 캘린더를 모르는 빈 시간이다. 첫 칸이 틀리면 `taskScheduleSuggestion`의 배치 추천, `travelTime`의 출발 시각, `notificationEventBuilder`의 알림까지 전부 틀린다.

## 완료 기준

1. 새 계정으로 로그인하고 아무것도 입력하지 않은 상태에서 주간 캘린더의 빈 시간이 iOS 캘린더와 일치한다.
2. 거절한 회의, 종일 일정, 자정을 넘기는 일정, 생일·공휴일 구독 캘린더가 각각 의도한 대로 처리된다.
3. 앱에서 만든 단기 일정이 시스템 캘린더에도 보이고, 그것이 다시 외부 일정으로 중복 계산되지 않는다.
4. 기기가 꺼져 있어도 서버가 사용자의 바쁜 시간대를 알 수 있다.

---

## 1. 구조 결정

### 세 플랫폼, 하나의 JS 인터페이스

| 플랫폼 | 구현 | 인증 |
| --- | --- | --- |
| iOS | `CalendarBridgePlugin.swift` — EventKit | OS 권한 |
| Android | `CalendarBridgePlugin.kt` — `CalendarContract` | OS 권한 |
| 웹 | `googleCalendarAdapter.ts` — Google Calendar API 읽기 | OAuth |

Android에서 Google Calendar API를 쓰지 않는 이유: 안드로이드 기기의 `CalendarContract`에는 이미 Google 계정이 동기화해둔 일정이 들어 있다. OAuth 없이 OS 권한만으로 읽을 수 있고, 회사 Exchange 계정처럼 Google 밖에 있는 일정도 같이 잡힌다. OAuth는 네이티브 앱을 쓸 수 없는 웹에서만 쓴다.

세 구현은 `src/lib/externalCalendar.ts` 하나의 인터페이스 뒤에 숨는다. 상위 코드는 어느 플랫폼인지 몰라야 한다. `nativeSystemAlarm.ts`가 AlarmKit을 감싸는 방식과 같다.

### 서버는 EventKit을 볼 수 없다

4단계 에이전트 루프는 서버에서 돈다. 서버는 사용자의 iPhone 안 EventKit에 접근할 수 없다. 따라서 기기가 **바쁜 시간대 요약(digest)** 을 Supabase에 올려야 한다. 이 설계는 8절에 있다.

---

## 2. JS 인터페이스

`src/types/externalCalendar.ts`

```ts
export type ExternalCalendarAuthorizationState =
  | "notDetermined"
  | "denied"
  | "restricted"
  | "readOnly"
  | "fullAccess"
  | "unavailable";

export type ExternalCalendarStatus = {
  available: boolean;
  authorizationState: ExternalCalendarAuthorizationState;
  provider: "eventkit" | "android-provider" | "google-api" | "none";
  canWrite: boolean;
  osVersion?: string;
  reason?: "notNativeIos" | "appUpdateRequired" | "bridgeError" | "notSignedIn";
};

export type ExternalCalendarSource = {
  /** EventKit calendarIdentifier / Android _id / Google calendarId */
  id: string;
  title: string;
  colorHex: string | null;
  /** 생일, 공휴일처럼 구독으로 들어온 캘린더 */
  isSubscribed: boolean;
  allowsModify: boolean;
  /** 계정 이름. "iCloud", "Gmail", 회사 Exchange 등 */
  sourceName: string;
};

export type ExternalCalendarEvent = {
  /** 플랫폼이 준 고유 id. 반복 일정은 회차마다 다르다. */
  externalId: string;
  calendarId: string;
  title: string;
  /** "2026-08-19" */
  date: string;
  /** "14:00". 종일 일정은 "00:00" */
  startTime: string;
  /** "15:30". 자정을 넘기면 다음 날짜로 쪼개서 두 개로 반환한다. */
  endTime: string;
  isAllDay: boolean;
  /** 시간을 점유하는지. free/투명 일정과 거절한 회의는 false */
  blocksTime: boolean;
  placeName: string | null;
  /** 앱이 만든 일정인지. true면 외부 일정으로 다시 계산하지 않는다. */
  createdByApp: boolean;
};
```

`ExternalCalendarEvent`를 `SingleSchedule`과 같은 모양(`date` + `startTime` + `endTime` + `placeName`)으로 맞춘 것은 의도적이다. 기존 계산 함수에 최소한의 변형으로 넣기 위해서다.

`src/lib/externalCalendar.ts`

```ts
export async function getExternalCalendarStatus(): Promise<ExternalCalendarStatus>;
export async function requestExternalCalendarAccess(
  level: "read" | "write"
): Promise<ExternalCalendarStatus>;
export async function listExternalCalendarSources(): Promise<ExternalCalendarSource[]>;
export async function fetchExternalCalendarEvents(options: {
  startDate: string;
  endDate: string;
  /** 비우면 사용자가 설정에서 켜둔 캘린더 전부 */
  calendarIds?: string[];
}): Promise<ExternalCalendarEvent[]>;

/** 1d */
export async function upsertExternalCalendarEvent(
  schedule: SingleSchedule
): Promise<{ externalId: string } | null>;
export async function deleteExternalCalendarEvent(externalId: string): Promise<void>;

/** 다른 앱에서 캘린더가 바뀌면 호출된다 */
export function onExternalCalendarChanged(listener: () => void): () => void;
```

모든 함수는 권한이 없거나 플러그인이 없으면 던지지 않고 빈 값으로 떨어진다. `nativeSystemAlarm.ts`와 같은 규칙이다. 캘린더 연동이 실패해도 앱은 지금처럼 동작해야 한다.

---

## 3. iOS 플러그인 명세

`ios/App/App/CalendarBridgePlugin.swift`

기존 플러그인 관례를 따른다: `CAPPlugin, CAPBridgedPlugin`, `jsName`, 그리고 `MySecretaryBridgeViewController.capacitorDidLoad()`에 `registerPluginInstance` 추가.

```swift
import Capacitor
import EventKit

@objc(CalendarBridgePlugin)
public class CalendarBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CalendarBridgePlugin"
    public let jsName = "CalendarBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listCalendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "upsertEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteEvent", returnType: CAPPluginReturnPromise)
    ]

    private let store = EKEventStore()
    /// 앱이 만든 일정만 모아두는 전용 캘린더 이름
    private let appCalendarTitle = "나의 비서"

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(storeChanged),
            name: .EKEventStoreChanged,
            object: store
        )
    }

    @objc private func storeChanged() {
        notifyListeners("calendarChanged", data: [:])
    }
}
```

### 권한

배포 타깃이 iOS 15.0이므로 두 경로를 모두 지원해야 한다.

```swift
@objc func requestAccess(_ call: CAPPluginCall) {
    let wantsWrite = call.getString("level") == "write"

    if #available(iOS 17.0, *) {
        if wantsWrite {
            store.requestWriteOnlyAccessToEvents { _, _ in self.resolveStatus(call) }
        } else {
            store.requestFullAccessToEvents { _, _ in self.resolveStatus(call) }
        }
    } else {
        store.requestAccess(to: .event) { _, _ in self.resolveStatus(call) }
    }
}
```

`EKAuthorizationStatus`를 JS 상태로 옮기는 표:

| iOS | JS |
| --- | --- |
| `.notDetermined` | `notDetermined` |
| `.denied` | `denied` |
| `.restricted` | `restricted` |
| `.authorized` (iOS 16 이하) | `fullAccess` |
| `.fullAccess` (iOS 17+) | `fullAccess` |
| `.writeOnly` (iOS 17+) | `readOnly`가 아니라 `denied`로 취급 |

`writeOnly`를 `denied`로 취급하는 이유: 쓰기 전용 권한으로는 일정을 읽을 수 없으므로 빈 시간 계산에 아무 도움이 안 된다. 사용자에게는 "읽기 권한이 필요합니다"로 안내해야 한다. 여기서 상태를 뭉개면 "왜 빈 시간이 여전히 틀리지"라는 디버깅 불가능한 상황이 된다.

Info.plist에 추가할 키:

```xml
<key>NSCalendarsFullAccessUsageDescription</key>
<string>일정이 이미 잡혀 있는 시간을 제외하고 진짜 비어 있는 시간을 찾기 위해 캘린더를 읽습니다.</string>
<key>NSCalendarsUsageDescription</key>
<string>일정이 이미 잡혀 있는 시간을 제외하고 진짜 비어 있는 시간을 찾기 위해 캘린더를 읽습니다.</string>
```

iOS 17+는 앞의 키를, 16 이하는 뒤의 키를 읽는다. 둘 다 넣는다.

### 조회

```swift
@objc func fetchEvents(_ call: CAPPluginCall) {
    guard let startText = call.getString("startDate"),
          let endText = call.getString("endDate") else {
        call.reject("startDate와 endDate가 필요합니다.")
        return
    }
    // 로컬 타임존 기준 자정 ~ 자정
    let calendars = selectedCalendars(from: call.getArray("calendarIds", String.self))
    let predicate = store.predicateForEvents(
        withStart: startOfDay(startText),
        end: endOfDay(endText),
        calendars: calendars
    )
    let events = store.events(matching: predicate)
    call.resolve(["events": events.flatMap(serialize)])
}
```

`store.events(matching:)`는 반복 일정을 회차 단위로 이미 펼쳐서 준다. 반복 규칙을 직접 해석하지 않는다. 이게 EventKit을 쓰는 가장 큰 이유다.

`flatMap`인 것에 주의: 한 이벤트가 0개(제외됨) 또는 2개 이상(자정 넘김)으로 변환될 수 있다.

---

## 4. 정확한 빈 시간을 위한 판정 규칙

이 절이 이 작업의 핵심이다. 이벤트를 그냥 다 가져와서 바쁜 시간으로 처리하면 빈 시간이 0이 되어 앱이 쓸모없어진다.

### 규칙 1 — 거절한 회의는 비워둔다

내가 거절한 회의는 캘린더에 남아 있어도 그 시간에 나는 자유롭다.

```swift
if let me = event.attendees?.first(where: { $0.isCurrentUser }),
   me.participantStatus == .declined {
    return []  // blocksTime = false 로 반환하고 계산에서 제외
}
```

`.pending`(미응답)은 바쁜 것으로 처리한다. 갈 가능성이 있는 일정 위에 다른 일을 배치하면 안 된다.

### 규칙 2 — 투명한 일정은 비워둔다

`event.availability == .free`인 일정은 "이 시간에 나를 바쁘게 표시하지 마세요"라는 뜻이다. 리마인더 성격의 일정이 대부분이다.

```swift
let blocksTime = event.availability != .free && event.availability != .unavailable
```

### 규칙 3 — 종일 일정은 기본적으로 비워둔다

"휴가", "OO 생일", "프로젝트 마감일" 같은 종일 일정을 24시간 바쁜 시간으로 처리하면 그 날 빈 시간이 0이 된다. 종일 일정은 `isAllDay: true, blocksTime: false`로 가져오되, **화면에는 표시**한다. 사용자가 하루의 맥락은 봐야 한다.

예외로 사용자가 특정 종일 일정을 "이 날은 통째로 비워둘 것"으로 지정할 수 있게 하는 건 4단계 이후로 미룬다.

### 규칙 4 — 자정을 넘기는 일정은 날짜별로 쪼갠다

`availability.ts`는 하루를 `startMinutes`/`endMinutes`로만 다룬다. 22:00~02:00 일정을 그대로 넣으면 `endMinutes < startMinutes`가 되어 `normalizeBusyBlocks()`가 그 블록을 버린다.

`calculateFreeTimeBlocksForDate()`가 단기 일정에 대해 이미 하고 있는 처리(`overnightContinuationBlocks`)와 같은 방식으로, 플러그인이 반환할 때 두 개의 `ExternalCalendarEvent`로 쪼갠다. 하루를 넘기는 여행 일정은 종일 일정으로 취급해 규칙 3으로 넘긴다.

계산 함수 쪽을 고치는 대신 플러그인 쪽에서 쪼개는 이유: 세 플랫폼 어댑터가 모두 같은 불변식(`date` 하나, `endTime > startTime`)을 지키게 하면 하위 코드는 아무것도 몰라도 된다.

### 규칙 5 — 구독 캘린더는 기본으로 끈다

공휴일, 스포츠 일정, 구독한 팀 캘린더는 `isSubscribed: true`로 들어온다. 이걸 바쁜 시간으로 잡으면 안 된다. 기본값은 다음과 같다.

- `isSubscribed == false`인 캘린더: 기본 켜짐
- `isSubscribed == true`인 캘린더: 기본 꺼짐
- 생일 캘린더(`EKCalendarType.birthday`): 항상 꺼짐, 목록에도 안 보임

사용자는 `설정 → 캘린더 연동`에서 캘린더별로 켜고 끌 수 있다. 이 선택은 `external_calendar_sources` 테이블에 저장한다.

### 규칙 6 — 앱이 만든 일정은 되읽지 않는다

1d에서 단기 일정을 시스템 캘린더에 쓰면, 다음 조회에서 그 일정이 외부 일정으로 다시 잡혀 같은 시간이 두 번 계산된다.

전용 캘린더 하나(`나의 비서`)를 만들어 앱이 쓴 일정은 거기에만 넣고, 조회할 때 그 캘린더의 이벤트에 `createdByApp: true`를 붙인다. `SingleSchedule`에 `externalEventId?: string`을 추가해 양쪽을 잇는다.

---

## 5. 계산 엔진에 넣는 방법

호출 지점이 많으므로 **선택 인자**로 넣어서 기존 호출부가 하나도 깨지지 않게 한다.

```ts
// src/lib/availability.ts
export function calculateFreeTimeBlocksForDate({
  date,
  routines,
  singleSchedules,
  externalEvents = [],   // 추가
}: CalculateFreeTimeBlocksForDateParams): FreeTimeBlock[] {
  // ...기존 blocks...
  const externalBusyBlocks = externalEvents
    .filter((event) => event.date === date && event.blocksTime)
    .map((event) => ({
      startMinutes: timeToMinutes(event.startTime),
      endMinutes: timeToMinutes(event.endTime),
    }));

  return calculateFreeTimeFromBusyBlocks([
    ...routineBusyBlocks,
    ...singleScheduleBusyBlocks,
    ...overnightContinuationBlocks,
    ...externalBusyBlocks,
  ]);
}
```

`normalizeBusyBlocks()`가 이미 겹치는 블록을 병합하므로, 정기 일정과 외부 일정이 같은 시간에 있어도 중복 차감되지 않는다. 기존 코드를 신뢰할 수 있는 지점이다.

같은 방식으로 `externalEvents`를 받는 곳:

| 파일 | 함수 | 용도 |
| --- | --- | --- |
| `availability.ts` | `calculateFreeTimeBlocksForDate` | 빈 시간 |
| `travelTime.ts` | `getScheduleBlocksForDate` | 이동 구간 계산 (`sourceType: "external"` 추가) |
| `taskScheduleSuggestion.ts` | 내부에서 위 두 함수를 부름 | 배치 추천 |
| `notificationEventBuilder.ts` | `buildNotificationEvents` | 알림 (2단계에서 순수 함수화된 뒤) |

화면 쪽에는 훅 하나를 만들어 반복을 없앤다.

```ts
// src/lib/useExternalCalendarEvents.ts
export function useExternalCalendarEvents(startDate: string, endDate: string): {
  events: ExternalCalendarEvent[];
  status: ExternalCalendarStatus;
  refresh: () => void;
};
```

`onExternalCalendarChanged`를 구독해 다른 앱에서 일정이 바뀌면 자동으로 다시 읽는다.

---

## 6. 캐시와 조회 범위

- 조회 범위: 오늘 기준 **-7일 ~ +90일**. `notificationEventBuilder`의 `SYNC_WINDOW_DAYS = 14`보다 넓게 잡아 월간 캘린더까지 커버한다.
- EventKit 조회는 빠르므로 화면 진입 시마다 다시 읽는다. 별도 증분 동기화는 만들지 않는다.
- 오프라인과 앱 시작 직후를 위해 마지막 조회 결과를 `localStorage`에 캐시한다. 키는 기존 관례를 따라 `STORAGE_KEYS.externalCalendarEvents = "my-assistant-external-calendar-events"`.
- 이 캐시는 **파생 데이터**다. `cloudDataSync.ts`의 동기화 도메인에 넣지 않는다. 넣으면 기기 A의 캘린더가 기기 B의 빈 시간을 오염시킨다.

---

## 7. 쓰기 (1d)

읽기가 완료되고 검증된 뒤에 시작한다.

1. 앱이 전용 캘린더 `나의 비서`를 `EKSource`(iCloud 우선, 없으면 local) 아래에 한 번 만든다.
2. `saveSingleSchedule()` 성공 후 `upsertExternalCalendarEvent()`를 부른다. 반환된 `externalId`를 `SingleSchedule.externalEventId`에 저장한다.
3. 단기 일정 삭제 시 `deleteExternalCalendarEvent()`를 부른다.
4. **앱은 자기가 만들지 않은 이벤트를 절대 수정하거나 삭제하지 않는다.** `event.calendar.calendarIdentifier`가 전용 캘린더가 아니면 쓰기 요청을 거부한다. 이 가드는 코드로 강제한다.

쓰기 실패(권한 없음, 캘린더 생성 실패)는 조용히 무시한다. 앱 안의 일정은 이미 저장됐고, 시스템 캘린더 반영은 부가 기능이다.

---

## 8. 서버가 읽을 수 있게 하는 방법

4단계 서버 루프가 알림을 만들려면 바쁜 시간대를 알아야 한다. 기기가 요약을 올린다.

```sql
create table external_busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  -- 기본은 null. 사용자가 제목 공유를 켰을 때만 채운다.
  title text,
  source_device text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, date, start_time, end_time, source_device)
);
```

설계 원칙:

- 올리는 것은 **시간대뿐**이다. 제목, 참석자, 장소, 메모는 기본적으로 올리지 않는다. 서버는 "이 사람은 14:00~15:30에 바쁘다"만 알면 배치와 알림을 만들 수 있다.
- 제목 공유는 별도 옵트인이다. 켜면 아침 브리핑이 "10시 팀 회의"라고 말할 수 있고, 끄면 "10시에 일정 있음"이라고 말한다. 기본값은 꺼짐.
- `source_device`로 기기를 구분해, 아이폰과 맥이 각각 올린 블록이 서로를 지우지 않게 한다.
- 업로드 시점: 앱이 포그라운드로 올라올 때, 그리고 `calendarChanged` 이벤트가 왔을 때. 창을 넘어간 과거 블록은 서버에서 정리한다.

---

## 9. 작업 순서

| | 작업 | 상태 | 산출물 |
| --- | --- | --- | --- |
| 1a | 타입과 인터페이스 정의, 미지원 플랫폼용 no-op 어댑터 | 완료 | `types/externalCalendar.ts`, `lib/externalCalendar.ts` |
| 1b | iOS 플러그인 구현 + 권한 + 판정 규칙 6개 | 완료 | `CalendarBridgePlugin.swift`, Info.plist, 플러그인 등록, pbxproj |
| 1c | 설정 화면에 캘린더별 켜기/끄기 | 완료 | `설정 → 캘린더 연동`, `externalCalendarSettings.ts` |
| 1d | 계산 엔진에 `externalEvents` 주입 + 훅 | 완료 | `availability.ts`, `travelTime.ts`, `taskScheduleSuggestion.ts`, `useExternalCalendarEvents.ts` |
| 1e | **실기기 검증 (완료 기준 1, 2번)** | 대기 — 실제 iPhone 필요 | — |
| 1f | 쓰기 역방향 반영 | 1e 이후 | `SingleSchedule.externalEventId` |
| 1g | Google Calendar 읽기 (웹) | 1e 이후 | `googleCalendarAdapter.ts`, OAuth 스코프 추가 |
| 1h | 서버 업로드 (`external_busy_blocks`) | 2단계와 함께 | Supabase 마이그레이션 |

`notificationEventBuilder.ts`는 아직 `externalEvents`를 받지 않는다. 이 함수는 내부에서 저장소를
직접 호출하고 있어 인자를 받는 형태가 아니므로, 2단계의 순수 함수화와 함께 처리한다.

1a~1e까지가 "완료 기준 1, 2번"을 만족시키는 최소 묶음이다. 1f~1h는 그 뒤에 붙인다.

Android(`CalendarBridgePlugin.kt`)는 iOS가 검증된 뒤 같은 인터페이스로 옮긴다. 안드로이드 출시가 아직 준비 단계이므로 순서를 뒤로 둔다.

---

## 10. 결정된 것

### 결정 1 — Gmail 동의 화면에 `calendar.readonly`를 얹지 않는다

**Google Cloud OAuth 클라이언트(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`)는 그대로 재사용하고, 플로우·스코프·토큰 저장소는 완전히 분리한다.**

결정적인 이유는 Google의 스코프 등급이다.

- `gmail.readonly`는 **restricted scope**다. 프로덕션 검증에 CASA 3rd-party 보안 심사가 붙고, 최고 등급(침투 테스트)에 해당하며 12개월마다 재심사해야 한다.
- `calendar.readonly`는 **sensitive scope**다. 검증은 필요하지만 restricted 등급의 침투 테스트 요구를 받지 않는다.

두 스코프를 한 동의 화면에 묶으면, **1단계 키스톤인 캘린더 읽기가 실험실로 내려둔 구매 메일 기능의 연 단위 보안 심사에 인질로 잡힌다.** 이건 받아들일 수 없다.

부수적인 이유:

- 동의 화면이 "메일 전체 읽기 + 캘린더 읽기"를 한 번에 요구하면 사용자가 거절한다. 캘린더만 쓰려는 사용자에게 필요 없는 Gmail 권한을 요구하는 것은 3단계에서 없앤 마찰을 다시 만드는 일이다.
- refresh token과 grant가 하나로 묶이면, 사용자가 실험실의 Gmail 연결을 끊는 순간 캘린더도 같이 죽는다.
- 캘린더 토큰을 `purchase_mail_connections` 테이블에 넣는 것은 도메인 경계가 틀렸다.

구현 결과:

| | Gmail (기존) | 캘린더 (신규) |
| --- | --- | --- |
| OAuth 클라이언트 | 공용 `GOOGLE_CLIENT_ID` | 같은 클라이언트 |
| redirect URI | `GOOGLE_GMAIL_REDIRECT_URI` | `GOOGLE_CALENDAR_REDIRECT_URI` (신규) |
| 스코프 | `gmail.readonly` | `calendar.readonly` |
| state 저장 | `purchase_mail_oauth_states` | `calendar_oauth_states` (신규) |
| 토큰 저장 | `purchase_mail_connections` | `calendar_connections` (신규) |

`gmailPurchaseSync.ts`에 묶여 있는 토큰 교환·갱신·암호화 로직은 `src/lib/googleOAuth.ts`로 빼서 두 플로우가 공유한다. `tokenEncryption.ts`는 그대로 쓴다.

Google Cloud 프로젝트나 OAuth 클라이언트를 새로 만들지는 않는다. redirect URI 하나 추가하면 되고, 클라이언트를 쪼개면 운영할 콘솔이 둘로 늘어난다.

### 결정 2 — 캘린더 권한을 넣고 심사를 새로 받는다

사용자 확인 완료. `NSCalendarsFullAccessUsageDescription`을 포함한 새 빌드로 심사를 다시 받는다. `docs/incomplete-features.md`의 심사 항목에 추가했다.

### 결정 3 — 제목 공유 기본값은 꺼짐

8절 그대로 유지한다. 아침 브리핑의 유용성이 달라지므로 4단계 진입 전에 다시 판단한다.

## 12. 이 결정이 순서에 주는 영향

웹 Google Calendar 연동(1g)은 restricted 스코프와 무관해졌지만, 여전히 **1b(EventKit) 뒤**다. 실제 사용 기기가 iPhone이고 심사를 통과한 빌드가 iOS이므로, 키스톤을 가장 빨리 세우는 경로는 EventKit이다. 1g는 OAuth 검증 대기 시간이 있으므로 1b 검증이 끝난 뒤 병렬로 시작한다.

## 11. 하지 않기로 한 것

- **CalDAV 직접 구현.** EventKit과 `CalendarContract`가 이미 계정 동기화를 해준다.
- **증분 동기화(change token).** 조회가 충분히 빠르다. 최적화는 실제로 느려진 뒤에 한다.
- **외부 일정 편집.** 앱은 자기가 만든 일정만 건드린다. 7절의 가드로 강제한다.
- **일정 충돌 자동 해결.** 외부 캘린더가 항상 우선이고, 앱은 그 위에 얹기만 한다.
