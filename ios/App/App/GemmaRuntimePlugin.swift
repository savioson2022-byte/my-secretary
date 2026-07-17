import Capacitor
import CryptoKit
import Foundation
import LiteRTLM

@objc(GemmaRuntimePlugin)
public class GemmaRuntimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GemmaRuntimePlugin"
    public let jsName = "GemmaRuntime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "installModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise)
    ]

    private let runtimeVersion = "LiteRT-LM 0.13"
    private let modelFileName = "gemma-4-E2B-it.litertlm"
    private let expectedModelBytes: Int64 = 2_588_147_712
    private let expectedModelSHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
    private let modelDownloadURL = URL(
        string: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
    )!
    private var engine: Engine?

    @objc func getStatus(_ call: CAPPluginCall) {
        let modelInstalled = modelFileURL().map(isPlausibleModelFile) ?? false
        call.resolve([
            "available": modelInstalled,
            "modelInstalled": modelInstalled,
            "runtimeVersion": runtimeVersion,
            "reason": modelInstalled
                ? "Gemma 4 E2B 모델이 설치되어 기기 추론을 사용할 수 있습니다."
                : "Gemma 4 E2B 모바일 모델이 기기에 설치되지 않았습니다."
        ])
    }

    @objc func installModel(_ call: CAPPluginCall) {
        Task {
            do {
                let destination = try modelDestinationURL()
                let temporaryURL = try await downloadModel()
                let fileSize = try fileSize(at: temporaryURL)

                guard fileSize == expectedModelBytes else {
                    try? FileManager.default.removeItem(at: temporaryURL)
                    throw GemmaRuntimeError.invalidSize
                }

                guard try sha256(at: temporaryURL) == expectedModelSHA256 else {
                    try? FileManager.default.removeItem(at: temporaryURL)
                    throw GemmaRuntimeError.invalidHash
                }

                try? FileManager.default.removeItem(at: destination)
                try FileManager.default.moveItem(at: temporaryURL, to: destination)
                engine = nil
                call.resolve(["installed": true, "bytes": fileSize])
            } catch {
                call.reject("Gemma 모델 설치 실패: \(error.localizedDescription)")
            }
        }
    }

    @objc func deleteModel(_ call: CAPPluginCall) {
        do {
            engine = nil
            if let modelURL = modelFileURL(), FileManager.default.fileExists(atPath: modelURL.path) {
                try FileManager.default.removeItem(at: modelURL)
            }
            call.resolve()
        } catch {
            call.reject("Gemma 모델 삭제 실패: \(error.localizedDescription)")
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let modelURL = modelFileURL(), isPlausibleModelFile(modelURL) else {
            call.reject("Gemma 모바일 모델이 설치되지 않았습니다.")
            return
        }

        let systemInstruction = call.getString("systemInstruction") ?? ""
        let inputJSON = call.getString("inputJson") ?? "{}"
        let memoriesJSON = call.getString("memoriesJson") ?? "[]"

        Task {
            do {
                let activeEngine = try await loadEngine(modelURL: modelURL)
                let sampler = try SamplerConfig(topK: 32, topP: 0.9, temperature: 0.2)
                let conversation = try await activeEngine.createConversation(
                    with: ConversationConfig(
                        systemMessage: Message(systemInstruction, role: .system),
                        samplerConfig: sampler
                    )
                )
                let prompt = """
                다음 입력을 처리하고 설명이나 마크다운 없이 유효한 JSON 하나만 출력하세요.
                개인 메모리: \(memoriesJSON)
                입력: \(inputJSON)
                """
                let response = try await conversation.sendMessage(Message(prompt))
                let output = response.contents.compactMap { content -> String? in
                    if case .text(let text) = content { return text }
                    return nil
                }.joined()
                let cleanedOutput = cleanJSON(output)
                guard let data = cleanedOutput.data(using: .utf8),
                      (try? JSONSerialization.jsonObject(with: data)) != nil else {
                    throw GemmaRuntimeError.invalidJSON
                }
                call.resolve(["outputJson": cleanedOutput])
            } catch {
                call.reject("Gemma 기기 추론 실패: \(error.localizedDescription)")
            }
        }
    }

    private func loadEngine(modelURL: URL) async throws -> Engine {
        if let engine, await engine.isInitialized() { return engine }
        let cacheURL = try FileManager.default.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("GemmaLiteRT", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheURL, withIntermediateDirectories: true)
        let config = try EngineConfig(
            modelPath: modelURL.path,
            backend: .gpu,
            maxNumTokens: 4096,
            cacheDir: cacheURL.path
        )
        let newEngine = Engine(engineConfig: config)
        try await newEngine.initialize()
        engine = newEngine
        return newEngine
    }

    private func modelFileURL() -> URL? {
        let fileManager = FileManager.default
        let bundledModel = Bundle.main.url(
            forResource: "gemma-4-E2B-it",
            withExtension: "litertlm",
            subdirectory: "Models"
        )

        if let bundledModel, fileManager.fileExists(atPath: bundledModel.path) {
            return bundledModel
        }

        guard let supportDirectory = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            return nil
        }

        return supportDirectory
            .appendingPathComponent("Gemma", isDirectory: true)
            .appendingPathComponent(modelFileName)
    }

    private func modelDestinationURL() throws -> URL {
        guard let supportDirectory = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else { throw GemmaRuntimeError.missingDirectory }
        let directory = supportDirectory.appendingPathComponent("Gemma", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(modelFileName)
    }

    private func downloadModel() async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            URLSession.shared.downloadTask(with: modelDownloadURL) { url, _, error in
                if let error { continuation.resume(throwing: error); return }
                guard let url else {
                    continuation.resume(throwing: GemmaRuntimeError.downloadFailed)
                    return
                }
                do {
                    let retainedURL = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString + ".litertlm")
                    try FileManager.default.moveItem(at: url, to: retainedURL)
                    continuation.resume(returning: retainedURL)
                } catch {
                    continuation.resume(throwing: error)
                }
            }.resume()
        }
    }

    private func fileSize(at url: URL) throws -> Int64 {
        let values = try url.resourceValues(forKeys: [.fileSizeKey])
        return Int64(values.fileSize ?? 0)
    }

    private func isPlausibleModelFile(_ url: URL) -> Bool {
        (try? fileSize(at: url)) == expectedModelBytes
    }

    private func sha256(at url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hash = SHA256()
        while autoreleasepool(invoking: {
            let data = handle.readData(ofLength: 4 * 1024 * 1024)
            if data.isEmpty { return false }
            hash.update(data: data)
            return true
        }) {}
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func cleanJSON(_ text: String) -> String {
        var result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if result.hasPrefix("```json") { result.removeFirst(7) }
        else if result.hasPrefix("```") { result.removeFirst(3) }
        if result.hasSuffix("```") { result.removeLast(3) }
        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private enum GemmaRuntimeError: LocalizedError {
    case downloadFailed, invalidSize, invalidHash, invalidJSON, missingDirectory
    var errorDescription: String? {
        switch self {
        case .downloadFailed: return "다운로드 파일을 받지 못했습니다."
        case .invalidSize: return "모델 파일 크기가 공식 배포본과 다릅니다."
        case .invalidHash: return "모델 무결성 검증에 실패했습니다."
        case .invalidJSON: return "모델이 올바른 JSON을 반환하지 않았습니다."
        case .missingDirectory: return "모델 저장 폴더를 만들 수 없습니다."
        }
    }
}
