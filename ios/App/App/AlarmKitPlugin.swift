import Capacitor
import Foundation
import UIKit
import UserNotifications

#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif

#if canImport(AlarmKit)
@available(iOS 26.0, *)
private struct MySecretaryAlarmMetadata: AlarmMetadata {
    let groupId: String
}
#endif

@objc(AlarmKitPlugin)
final class AlarmKitPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "AlarmKitPlugin"
    let jsName = "AlarmKit"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]

    @objc func getStatus(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            resolveFallbackStatus(call)
            return
        }

        #if canImport(AlarmKit)
        call.resolve(statusPayload(AlarmManager.shared.authorizationState))
        #else
        resolveFallbackStatus(call)
        #endif
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            requestFallbackAuthorization(call)
            return
        }

        #if canImport(AlarmKit)
        Task {
            do {
                let state = try await AlarmManager.shared.requestAuthorization()
                call.resolve(statusPayload(state))
            } catch {
                call.reject("시스템 알람 권한을 요청하지 못했습니다.")
            }
        }
        #else
        requestFallbackAuthorization(call)
        #endif
    }

    @objc func schedule(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            scheduleFallbackNotification(call)
            return
        }

        #if canImport(AlarmKit)
        guard
            let idText = call.getString("id"),
            let id = UUID(uuidString: idText),
            let title = call.getString("title"),
            let fireAtText = call.getString("fireAt"),
            let fireAt = parseISODate(fireAtText)
        else {
            call.reject("알람 정보가 올바르지 않습니다.")
            return
        }

        let stopButton = AlarmButton(
            text: "확인",
            textColor: .white,
            systemImageName: "checkmark.circle.fill"
        )
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: stopButton
        )
        let presentation = AlarmPresentation(alert: alert)
        let attributes = AlarmAttributes<MySecretaryAlarmMetadata>(
            presentation: presentation,
            metadata: MySecretaryAlarmMetadata(groupId: call.getString("groupId") ?? idText),
            tintColor: .orange
        )
        let configuration = AlarmManager.AlarmConfiguration.alarm(
            schedule: .fixed(fireAt),
            attributes: attributes,
            sound: .default
        )

        Task {
            do {
                try await AlarmManager.shared.schedule(id: id, configuration: configuration)
                call.resolve(["scheduled": true])
            } catch {
                call.reject("시스템 알람을 예약하지 못했습니다.")
            }
        }
        #else
        scheduleFallbackNotification(call)
        #endif
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            cancelFallbackNotification(call)
            return
        }

        #if canImport(AlarmKit)
        guard let idText = call.getString("id"), let id = UUID(uuidString: idText) else {
            call.reject("알람 식별자가 올바르지 않습니다.")
            return
        }
        Task {
            do {
                try AlarmManager.shared.cancel(id: id)
                call.resolve()
            } catch {
                call.reject("시스템 알람을 취소하지 못했습니다.")
            }
        }
        #else
        cancelFallbackNotification(call)
        #endif
    }

    private func requestFallbackAuthorization(_ call: CAPPluginCall) {
        var options: UNAuthorizationOptions = [.alert, .sound, .badge]
        if #available(iOS 15.0, *) {
            options.insert(.timeSensitive)
        }
        UNUserNotificationCenter.current().requestAuthorization(options: options) { [weak self] _, error in
            if error != nil {
                call.reject("강한 알림 권한을 요청하지 못했습니다.")
                return
            }
            self?.resolveFallbackStatus(call)
        }
    }

    private func resolveFallbackStatus(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let state: String
            switch settings.authorizationStatus {
            case .notDetermined: state = "notDetermined"
            case .denied: state = "denied"
            case .authorized, .provisional, .ephemeral: state = "authorized"
            @unknown default: state = "denied"
            }

            let mode: String
            if #available(iOS 15.0, *), settings.timeSensitiveSetting == .enabled {
                mode = "timeSensitive"
            } else {
                mode = "standard"
            }

            call.resolve([
                "available": true,
                "systemAlarmAvailable": false,
                "fallbackAvailable": true,
                "authorizationState": state,
                "mode": mode,
                "osVersion": UIDevice.current.systemVersion,
            ])
        }
    }

    private func scheduleFallbackNotification(_ call: CAPPluginCall) {
        guard
            let idText = call.getString("id"),
            let title = call.getString("title"),
            let fireAtText = call.getString("fireAt"),
            let fireAt = parseISODate(fireAtText)
        else {
            call.reject("알람 정보가 올바르지 않습니다.")
            return
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = "중요한 일정입니다. 알림을 열어 확인하거나 다시 알림을 선택하세요."
        content.sound = .default
        content.categoryIdentifier = "persistent-alarm-actions"
        content.threadIdentifier = "persistent-\(call.getString("groupId") ?? idText)"
        if #available(iOS 15.0, *) {
            content.interruptionLevel = .timeSensitive
        }

        let interval = max(1, fireAt.timeIntervalSinceNow)
        let request = UNNotificationRequest(
            identifier: idText,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        )
        UNUserNotificationCenter.current().add(request) { error in
            if error != nil {
                call.reject("강한 대체 알림을 예약하지 못했습니다.")
            } else {
                call.resolve(["scheduled": true, "mode": "timeSensitive"])
            }
        }
    }

    private func cancelFallbackNotification(_ call: CAPPluginCall) {
        guard let idText = call.getString("id") else {
            call.resolve()
            return
        }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [idText])
        center.removeDeliveredNotifications(withIdentifiers: [idText])
        call.resolve()
    }

    private func parseISODate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    #if canImport(AlarmKit)
    @available(iOS 26.0, *)
    private func statusPayload(_ state: AlarmManager.AuthorizationState) -> [String: Any] {
        let text: String
        switch state {
        case .notDetermined: text = "notDetermined"
        case .denied: text = "denied"
        case .authorized: text = "authorized"
        @unknown default: text = "denied"
        }
        return [
            "available": true,
            "systemAlarmAvailable": true,
            "fallbackAvailable": true,
            "authorizationState": text,
            "mode": "alarmKit",
            "osVersion": UIDevice.current.systemVersion,
        ]
    }
    #endif
}
