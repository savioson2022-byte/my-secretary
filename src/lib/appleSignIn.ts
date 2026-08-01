import { Capacitor, registerPlugin } from "@capacitor/core";

type AppleSignInResult = {
  identityToken: string;
  nonce: string;
  email?: string;
  fullName?: string;
};

type AppleSignInPlugin = {
  signIn(): Promise<AppleSignInResult>;
};

const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");

export function canUseNativeAppleSignIn() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function signInWithAppleNative() {
  if (!canUseNativeAppleSignIn()) {
    throw new Error("Apple 로그인은 iPhone 또는 iPad 앱에서 사용할 수 있습니다.");
  }

  return AppleSignIn.signIn();
}
