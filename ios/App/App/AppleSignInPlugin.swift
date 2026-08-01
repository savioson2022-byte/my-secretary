import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation
import Security
import UIKit

@objc(AppleSignInPlugin)
public final class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var rawNonce: String?

    @objc func signIn(_ call: CAPPluginCall) {
        guard #available(iOS 13.0, *) else {
            call.reject("Apple 로그인은 iOS 13 이상에서 사용할 수 있습니다.")
            return
        }

        guard pendingCall == nil else {
            call.reject("Apple 로그인이 이미 진행 중입니다.")
            return
        }

        guard let nonce = makeNonce() else {
            call.reject("Apple 로그인 보안 값을 만들지 못했습니다.")
            return
        }

        pendingCall = call
        rawNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    public func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }

        return ASPresentationAnchor()
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let identityToken = String(data: tokenData, encoding: .utf8),
            let nonce = rawNonce,
            let call = pendingCall
        else {
            rejectPending("Apple 로그인 정보를 확인하지 못했습니다.")
            return
        }

        let formatter = PersonNameComponentsFormatter()
        let fullName = credential.fullName.map(formatter.string(from:)) ?? ""

        call.resolve([
            "identityToken": identityToken,
            "nonce": nonce,
            "email": credential.email ?? "",
            "fullName": fullName
        ])
        clearPending()
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        if let authorizationError = error as? ASAuthorizationError,
           authorizationError.code == .canceled {
            rejectPending("Apple 로그인이 취소되었습니다.")
            return
        }

        rejectPending("Apple 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.")
    }

    private func rejectPending(_ message: String) {
        pendingCall?.reject(message)
        clearPending()
    }

    private func clearPending() {
        pendingCall = nil
        rawNonce = nil
    }

    private func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    private func makeNonce(length: Int = 32) -> String? {
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length

        while remaining > 0 {
            var random = [UInt8](repeating: 0, count: 16)
            guard SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess else {
                return nil
            }

            for byte in random where remaining > 0 {
                if byte < characters.count {
                    result.append(characters[Int(byte)])
                    remaining -= 1
                }
            }
        }

        return result
    }
}
