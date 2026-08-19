import Capacitor

@objc(MySecretaryBridgeViewController)
final class MySecretaryBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(GemmaRuntimePlugin())
        bridge?.registerPluginInstance(AlarmKitPlugin())
        bridge?.registerPluginInstance(AlarmPulsePlugin())
        bridge?.registerPluginInstance(CalendarBridgePlugin())
        bridge?.registerPluginInstance(GeofencePlugin())
    }
}
