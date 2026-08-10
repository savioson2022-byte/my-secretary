import Capacitor
import Foundation

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
            call.resolve(["available": false, "authorizationState": "unavailable"])
            return
        }

        #if canImport(AlarmKit)
        call.resolve(statusPayload(AlarmManager.shared.authorizationState))
        #else
        call.resolve(["available": false, "authorizationState": "unavailable"])
        #endif
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve(["available": false, "authorizationState": "unavailable"])
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
        call.resolve(["available": false, "authorizationState": "unavailable"])
        #endif
    }

    @objc func schedule(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve(["scheduled": false])
            return
        }

        #if canImport(AlarmKit)
        guard
            let idText = call.getString("id"),
            let id = UUID(uuidString: idText),
            let title = call.getString("title"),
            let fireAtText = call.getString("fireAt"),
            let fireAt = ISO8601DateFormatter().date(from: fireAtText)
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
        call.resolve(["scheduled": false])
        #endif
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else {
            call.resolve()
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
        call.resolve()
        #endif
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
        return ["available": true, "authorizationState": text]
    }
    #endif
}
