import Capacitor

@objc(MySecretaryBridgeViewController)
final class MySecretaryBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GemmaRuntimePlugin())
    }
}
