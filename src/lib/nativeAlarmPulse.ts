import { Capacitor, registerPlugin } from "@capacitor/core";

type AlarmPulsePlugin = {
  start(options?: { interval?: number }): Promise<void>;
  stop(): Promise<void>;
};

const AlarmPulse = registerPlugin<AlarmPulsePlugin>("AlarmPulse");

export async function startNativeAlarmPulse(interval = 1.25) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await AlarmPulse.start({ interval });
  } catch {
    // 구버전 앱처럼 네이티브 플러그인이 아직 없는 경우에는 웹 알람만 사용합니다.
  }
}

export async function stopNativeAlarmPulse() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await AlarmPulse.stop();
  } catch {
    // 구버전 앱처럼 네이티브 플러그인이 아직 없는 경우에는 무시합니다.
  }
}
