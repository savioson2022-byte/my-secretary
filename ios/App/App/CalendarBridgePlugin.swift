import Capacitor
import EventKit
import UIKit

/// 시스템 캘린더를 읽어 앱의 빈 시간 계산에 넣기 위한 플러그인.
///
/// 이 단계에서는 읽기만 한다. 쓰기(전용 캘린더에 단기 일정 반영)는 1f에서 붙인다.
/// 판정 규칙은 docs/calendar-integration-plan.md 4절과 1:1로 대응한다.
@objc(CalendarBridgePlugin)
public class CalendarBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CalendarBridgePlugin"
    public let jsName = "CalendarBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listCalendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchEvents", returnType: CAPPluginReturnPromise)
    ]

    /// 앱이 만든 일정만 담을 전용 캘린더. 1f에서 만들고, 지금은 되읽기 제외에만 쓴다.
    private static let appCalendarTitle = "나의 비서"

    private let store = EKEventStore()

    private lazy var dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.timeZone = Calendar.current.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleStoreChanged),
            name: .EKEventStoreChanged,
            object: store
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleStoreChanged() {
        notifyListeners("calendarChanged", data: [:])
    }

    // MARK: - 권한

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(statusPayload())
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        let completion: (Bool, Error?) -> Void = { [weak self] _, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                call.resolve(self.statusPayload())
            }
        }

        // 읽기가 목적이므로 항상 전체 접근을 요청한다.
        // 쓰기 전용 권한으로는 일정을 읽을 수 없어 빈 시간 계산에 쓸 수 없다.
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents(completion: completion)
        } else {
            store.requestAccess(to: .event, completion: completion)
        }
    }

    private func statusPayload() -> [String: Any] {
        let state = authorizationStateText()

        return [
            "available": true,
            "authorizationState": state,
            "provider": "eventkit",
            "canWrite": state == "fullAccess",
            "osVersion": UIDevice.current.systemVersion
        ]
    }

    /// iOS 17의 writeOnly는 읽을 수 없으므로 denied로 취급한다.
    /// 여기서 상태를 뭉개면 "왜 빈 시간이 여전히 틀리지"라는 추적 불가능한 버그가 된다.
    private func authorizationStateText() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)

        if #available(iOS 17.0, *) {
            switch status {
            case .notDetermined: return "notDetermined"
            case .restricted: return "restricted"
            case .denied: return "denied"
            case .fullAccess: return "fullAccess"
            case .writeOnly: return "denied"
            @unknown default: return "denied"
            }
        }

        // iOS 16 이하. 최신 SDK로 컴파일하면 .fullAccess 같은 케이스도 타입에 존재하므로
        // @unknown default 대신 일반 default로 남긴다.
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized: return "fullAccess"
        default: return "denied"
        }
    }

    private var hasReadAccess: Bool {
        authorizationStateText() == "fullAccess"
    }

    // MARK: - 캘린더 목록

    @objc func listCalendars(_ call: CAPPluginCall) {
        guard hasReadAccess else {
            call.resolve(["calendars": []])
            return
        }

        // 규칙 5: 생일 캘린더는 목록에도 보여주지 않는다.
        let calendars = store.calendars(for: .event)
            .filter { $0.type != .birthday }
            .map { calendar -> [String: Any] in
                [
                    "id": calendar.calendarIdentifier,
                    "title": calendar.title,
                    "colorHex": hexText(from: calendar.cgColor) ?? NSNull(),
                    "isSubscribed": calendar.isSubscribed || calendar.type == .subscription,
                    "allowsModify": calendar.allowsContentModifications,
                    "sourceName": calendar.source?.title ?? ""
                ]
            }

        call.resolve(["calendars": calendars])
    }

    // MARK: - 일정 조회

    @objc func fetchEvents(_ call: CAPPluginCall) {
        guard
            let startText = call.getString("startDate"),
            let endText = call.getString("endDate"),
            let rangeStart = startOfDay(startText),
            let rangeEnd = endOfDay(endText)
        else {
            call.reject("startDate와 endDate가 필요합니다. 형식은 yyyy-MM-dd입니다.")
            return
        }

        guard hasReadAccess else {
            call.resolve(["events": []])
            return
        }

        let calendars = calendarsToQuery(requestedIds: call.getArray("calendarIds", String.self))

        if let calendars, calendars.isEmpty {
            call.resolve(["events": []])
            return
        }

        // events(matching:)은 반복 일정을 회차 단위로 이미 펼쳐서 준다.
        let predicate = store.predicateForEvents(
            withStart: rangeStart,
            end: rangeEnd,
            calendars: calendars
        )
        let events = store.events(matching: predicate).flatMap { serialize($0) }

        call.resolve(["events": events])
    }

    /// nil을 반환하면 EventKit이 전체 캘린더를 조회한다.
    private func calendarsToQuery(requestedIds: [String]?) -> [EKCalendar]? {
        let selectable = store.calendars(for: .event).filter { $0.type != .birthday }

        guard let requestedIds, !requestedIds.isEmpty else {
            return selectable
        }

        return selectable.filter { requestedIds.contains($0.calendarIdentifier) }
    }

    // MARK: - 변환과 판정 규칙

    /// 이벤트 하나가 0개(제외) 또는 여러 개(자정 넘김)로 변환될 수 있다.
    private func serialize(_ event: EKEvent) -> [[String: Any]] {
        guard let startDate = event.startDate, let endDate = event.endDate else {
            return []
        }

        let createdByApp = event.calendar?.title == Self.appCalendarTitle

        // 규칙 3: 종일 일정은 하루의 맥락으로 보여주되 시간을 점유하지 않는다.
        // 종일 일정을 24시간 점유로 처리하면 그 날 빈 시간이 0이 된다.
        if event.isAllDay {
            return dateTexts(from: startDate, to: endDate).map { dateText in
                payload(
                    event: event,
                    date: dateText,
                    startTime: "00:00",
                    endTime: "24:00",
                    isAllDay: true,
                    blocksTime: false,
                    exclusionReason: "allDay",
                    createdByApp: createdByApp
                )
            }
        }

        let exclusionReason = findExclusionReason(event)
        let blocksTime = exclusionReason == nil

        // 규칙 4: 자정을 넘기는 일정은 날짜별로 쪼갠다.
        // availability.ts는 하루를 분 단위로만 다루므로, endTime < startTime인
        // 블록은 normalizeBusyBlocks()에서 조용히 버려진다.
        var results: [[String: Any]] = []
        var cursor = startDate
        let calendar = Calendar.current

        while cursor < endDate {
            guard
                let nextDay = calendar.date(byAdding: .day, value: 1, to: cursor)
            else {
                break
            }

            let dayEnd = calendar.startOfDay(for: nextDay)
            let segmentEnd = min(endDate, dayEnd)

            results.append(
                payload(
                    event: event,
                    date: dateOnlyFormatter.string(from: cursor),
                    startTime: timeText(from: cursor),
                    // 자정에 끝나는 구간은 "24:00"으로 보낸다.
                    // timeToMinutes("24:00")은 1440이고 DAY_END_MINUTES와 같다.
                    endTime: segmentEnd == dayEnd ? "24:00" : timeText(from: segmentEnd),
                    isAllDay: false,
                    blocksTime: blocksTime,
                    exclusionReason: exclusionReason,
                    createdByApp: createdByApp
                )
            )

            cursor = segmentEnd

            // 시간 지정 일정이 30일을 넘기면 데이터 오류로 보고 멈춘다.
            if results.count > 30 { break }
        }

        return results
    }

    /// 시간을 점유하지 않는다면 그 이유를, 점유한다면 nil을 돌려준다.
    /// 이유를 그대로 JS로 넘겨서 어떤 규칙이 걸렸는지 화면에서 확인할 수 있게 한다.
    private func findExclusionReason(_ event: EKEvent) -> String? {
        // 규칙 1: 내가 거절한 회의는 캘린더에 남아 있어도 그 시간에 나는 자유롭다.
        // 미응답(.pending)은 갈 가능성이 있으므로 바쁜 것으로 둔다.
        if let me = event.attendees?.first(where: { $0.isCurrentUser }),
           me.participantStatus == .declined {
            return "declined"
        }

        // 규칙 2: 한가함으로 표시된 일정은 시간을 점유하지 않는다.
        if event.availability == .free {
            return "free"
        }

        if event.status == .canceled {
            return "canceled"
        }

        return nil
    }

    private func payload(
        event: EKEvent,
        date: String,
        startTime: String,
        endTime: String,
        isAllDay: Bool,
        blocksTime: Bool,
        exclusionReason: String?,
        createdByApp: Bool
    ) -> [String: Any] {
        let place = event.location?.trimmingCharacters(in: .whitespacesAndNewlines)

        return [
            // 반복 일정은 회차마다 다른 id가 필요하므로 날짜와 시작 시각을 붙인다.
            "externalId": "\(event.eventIdentifier ?? UUID().uuidString)#\(date)T\(startTime)",
            "calendarId": event.calendar?.calendarIdentifier ?? "",
            "title": event.title ?? "제목 없는 일정",
            "date": date,
            "startTime": startTime,
            "endTime": endTime,
            "isAllDay": isAllDay,
            "blocksTime": blocksTime,
            "exclusionReason": exclusionReason as Any? ?? NSNull(),
            "placeName": (place?.isEmpty == false ? place! : nil) as Any? ?? NSNull(),
            "createdByApp": createdByApp
        ]
    }

    // MARK: - 날짜 도우미

    private func startOfDay(_ dateText: String) -> Date? {
        guard let date = dateOnlyFormatter.date(from: dateText) else { return nil }
        return Calendar.current.startOfDay(for: date)
    }

    private func endOfDay(_ dateText: String) -> Date? {
        guard let start = startOfDay(dateText) else { return nil }
        guard let nextDay = Calendar.current.date(byAdding: .day, value: 1, to: start) else {
            return nil
        }
        return Calendar.current.startOfDay(for: nextDay)
    }

    private func timeText(from date: Date) -> String {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }

    /// 종일 일정이 걸쳐 있는 모든 날짜.
    private func dateTexts(from startDate: Date, to endDate: Date) -> [String] {
        let calendar = Calendar.current
        var results: [String] = []
        var cursor = calendar.startOfDay(for: startDate)
        // EventKit의 종일 일정 endDate는 마지막 날의 시작을 가리킨다.
        let last = calendar.startOfDay(for: endDate)

        while cursor <= last {
            results.append(dateOnlyFormatter.string(from: cursor))

            guard let nextDay = calendar.date(byAdding: .day, value: 1, to: cursor) else {
                break
            }
            cursor = nextDay

            if results.count > 366 { break }
        }

        return results
    }

    private func hexText(from color: CGColor?) -> String? {
        guard let components = color?.components, components.count >= 3 else {
            return nil
        }

        let red = Int((components[0] * 255).rounded())
        let green = Int((components[1] * 255).rounded())
        let blue = Int((components[2] * 255).rounded())

        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
