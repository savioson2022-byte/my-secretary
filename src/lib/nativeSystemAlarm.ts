import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeSystemAlarmStatus = {
  available: boolean;
  authorizationState: "notDetermined" | "denied" | "authorized" | "unavailable";
  systemAlarmAvailable?: boolean;
  fallbackAvailable?: boolean;
  mode?: "alarmKit" | "timeSensitive" | "standard" | "unavailable";
  osVersion?: string;
  reason?: "notNativeIos" | "appUpdateRequired" | "bridgeError";
};

type AlarmKitPlugin = {
  getStatus(): Promise<NativeSystemAlarmStatus>;
  requestAuthorization(): Promise<NativeSystemAlarmStatus>;
  schedule(options: {
    id: string;
    title: string;
    fireAt: string;
    groupId: string;
  }): Promise<{ scheduled: boolean }>;
  cancel(options: { id: string }): Promise<void>;
};

const AlarmKit = registerPlugin<AlarmKitPlugin>("AlarmKit");

export async function getNativeSystemAlarmStatus(): Promise<NativeSystemAlarmStatus> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return { available: false, authorizationState: "unavailable", mode: "unavailable", reason: "notNativeIos" };
  }

  if (!Capacitor.isPluginAvailable("AlarmKit")) {
    return { available: false, authorizationState: "unavailable", mode: "unavailable", reason: "appUpdateRequired" };
  }

  try {
    return await AlarmKit.getStatus();
  } catch {
    return { available: false, authorizationState: "unavailable", mode: "unavailable", reason: "bridgeError" };
  }
}

export async function requestNativeSystemAlarmPermission() {
  try {
    return await AlarmKit.requestAuthorization();
  } catch {
    return { available: false, authorizationState: "unavailable" as const, mode: "unavailable" as const };
  }
}

export async function scheduleNativeSystemAlarm(options: {
  groupId: string;
  title: string;
  fireAt: Date;
}) {
  const status = await getNativeSystemAlarmStatus();
  if (!status.available || status.authorizationState !== "authorized") return false;

  try {
    await AlarmKit.schedule({
      id: stableAlarmUUID(options.groupId),
      title: options.title,
      fireAt: options.fireAt.toISOString(),
      groupId: options.groupId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelNativeSystemAlarm(groupId: string) {
  try {
    await AlarmKit.cancel({ id: stableAlarmUUID(groupId) });
  } catch {
    // AlarmKit 미지원 기기에서는 로컬 알림 취소만 수행합니다.
  }
}

function stableAlarmUUID(value: string) {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index % 16] = (bytes[index % 16] * 31 + value.charCodeAt(index)) & 255;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
