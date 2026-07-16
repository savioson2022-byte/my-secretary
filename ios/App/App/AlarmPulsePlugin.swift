import AVFoundation
import Capacitor
import UIKit

@objc(AlarmPulsePlugin)
public class AlarmPulsePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlarmPulsePlugin"
    public let jsName = "AlarmPulse"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var timer: Timer?
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var feedbackGenerator: UINotificationFeedbackGenerator?

    @objc func start(_ call: CAPPluginCall) {
        let interval = max(0.8, call.getDouble("interval") ?? 1.25)

        DispatchQueue.main.async { [weak self] in
            self?.startPulse(interval: interval)
        }

        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.stopPulse()
        }

        call.resolve()
    }

    private func startPulse(interval: TimeInterval) {
        stopPulse()

        try? AVAudioSession.sharedInstance().setCategory(
            .playback,
            mode: .default,
            options: [.mixWithOthers]
        )
        try? AVAudioSession.sharedInstance().setActive(true)

        feedbackGenerator = UINotificationFeedbackGenerator()
        feedbackGenerator?.prepare()

        pulse()

        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) {
            [weak self] _ in
            self?.pulse()
        }

        if let timer {
            RunLoop.main.add(timer, forMode: .common)
        }
    }

    private func stopPulse() {
        timer?.invalidate()
        timer = nil
        playerNode?.stop()
        audioEngine?.stop()
        feedbackGenerator = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func pulse() {
        feedbackGenerator?.notificationOccurred(.warning)
        feedbackGenerator?.prepare()
        playTone()
    }

    private func playTone() {
        let sampleRate = 44_100.0
        let duration = 0.32
        let frameCount = AVAudioFrameCount(sampleRate * duration)

        guard
            let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
            let channel = buffer.floatChannelData?[0]
        else {
            return
        }

        buffer.frameLength = frameCount

        for frame in 0..<Int(frameCount) {
            let time = Double(frame) / sampleRate
            let attack = min(1.0, Double(frame) / 900.0)
            let release = min(1.0, Double(Int(frameCount) - frame) / 1_800.0)
            let envelope = attack * release
            let toneA = sin(2.0 * Double.pi * 880.0 * time)
            let toneB = sin(2.0 * Double.pi * 660.0 * time)
            channel[frame] = Float((toneA * 0.28 + toneB * 0.12) * envelope)
        }

        let engine = audioEngine ?? AVAudioEngine()
        let node = playerNode ?? AVAudioPlayerNode()

        if audioEngine == nil || playerNode == nil {
            engine.attach(node)
            engine.connect(node, to: engine.mainMixerNode, format: format)
            audioEngine = engine
            playerNode = node
        }

        if !engine.isRunning {
            try? engine.start()
        }

        node.scheduleBuffer(buffer, at: nil, options: [])

        if !node.isPlaying {
            node.play()
        }
    }
}
