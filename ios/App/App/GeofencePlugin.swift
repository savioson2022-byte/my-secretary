import Capacitor
import CoreLocation

/// 저장한 장소에 도착하거나 벗어난 것을 OS가 알려주게 한다.
///
/// 기존 adaptiveTravelNotifications는 30분마다 위치를 직접 확인했다.
/// region monitoring은 앱이 꺼져 있어도 OS가 깨워주고 배터리도 훨씬 덜 쓴다.
@objc(GeofencePlugin)
public class GeofencePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "GeofencePlugin"
    public let jsName = "Geofence"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlwaysAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "replaceRegions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearRegions", returnType: CAPPluginReturnPromise)
    ]

    /// iOS가 한 앱에 허용하는 region은 20개다. 가까운 순서로 골라 넣는다.
    private static let maxRegions = 20
    private static let defaultRadius = 150.0

    private let manager = CLLocationManager()

    override public func load() {
        manager.delegate = self
    }

    // MARK: - 권한

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(statusPayload())
    }

    @objc func requestAlwaysAccess(_ call: CAPPluginCall) {
        let status = manager.authorizationStatus

        // whenInUse를 먼저 받아야 always를 요청할 수 있다.
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else if status == .authorizedWhenInUse {
            manager.requestAlwaysAuthorization()
        }

        call.resolve(statusPayload())
    }

    private func statusPayload() -> [String: Any] {
        return [
            "available": CLLocationManager.isMonitoringAvailable(
                for: CLCircularRegion.self
            ),
            "authorizationState": authorizationStateText(),
            "monitoredCount": manager.monitoredRegions.count,
            "maxRegions": Self.maxRegions
        ]
    }

    private func authorizationStateText() -> String {
        switch manager.authorizationStatus {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorizedWhenInUse: return "whenInUse"
        case .authorizedAlways: return "always"
        @unknown default: return "denied"
        }
    }

    // MARK: - 감시 영역

    @objc func replaceRegions(_ call: CAPPluginCall) {
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
            call.resolve(["monitoredCount": 0])
            return
        }

        // 항상 허용이 아니면 앱이 꺼진 동안 알림을 받을 수 없다.
        guard manager.authorizationStatus == .authorizedAlways else {
            call.resolve(["monitoredCount": 0, "reason": "needsAlwaysAuthorization"])
            return
        }

        stopAllMonitoring()

        let places = call.getArray("places", JSObject.self) ?? []
        var monitoredCount = 0

        for place in places.prefix(Self.maxRegions) {
            guard
                let id = place["id"] as? String,
                let latitude = place["latitude"] as? Double,
                let longitude = place["longitude"] as? Double
            else {
                continue
            }

            let radius = min(
                place["radius"] as? Double ?? Self.defaultRadius,
                manager.maximumRegionMonitoringDistance
            )
            let region = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                radius: radius,
                identifier: id
            )
            region.notifyOnEntry = true
            region.notifyOnExit = true

            manager.startMonitoring(for: region)
            monitoredCount += 1
        }

        call.resolve(["monitoredCount": monitoredCount])
    }

    @objc func clearRegions(_ call: CAPPluginCall) {
        stopAllMonitoring()
        call.resolve(["monitoredCount": 0])
    }

    private func stopAllMonitoring() {
        for region in manager.monitoredRegions {
            manager.stopMonitoring(for: region)
        }
    }

    // MARK: - 이벤트

    public func locationManager(
        _ manager: CLLocationManager,
        didEnterRegion region: CLRegion
    ) {
        notifyListeners(
            "placeArrived",
            data: ["placeId": region.identifier, "occurredAt": nowText()]
        )
    }

    public func locationManager(
        _ manager: CLLocationManager,
        didExitRegion region: CLRegion
    ) {
        notifyListeners(
            "placeLeft",
            data: ["placeId": region.identifier, "occurredAt": nowText()]
        )
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        notifyListeners("authorizationChanged", data: statusPayload())
    }

    private func nowText() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date())
    }
}
