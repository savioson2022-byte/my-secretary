"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNotificationEvents } from "@/lib/notificationEventBuilder";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/lib/notificationSettingsStorage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { NotificationSettings } from "@/types/notification";

const TOGGLE_OPTIONS: Array<{
  key: keyof Pick<
    NotificationSettings,
    | "scheduleNotificationsEnabled"
    | "travelNotificationsEnabled"
    | "purchaseNotificationsEnabled"
    | "routineReminderEnabled"
    | "locationNotificationsEnabled"
  >;
  title: string;
  description: string;
}> = [
  {
    key: "scheduleNotificationsEnabled",
    title: "일정 시작/준비 알림",
    description: "정기일정과 단기일정 시작 전후에 알립니다.",
  },
  {
    key: "travelNotificationsEnabled",
    title: "이동 시작 알림",
    description: "장소가 있는 일정은 출발 시간을 따로 확인합니다.",
  },
  {
    key: "purchaseNotificationsEnabled",
    title: "재구매 추천 알림",
    description: "구매템 확인일이 되면 다시 살지 알려줍니다.",
  },
  {
    key: "routineReminderEnabled",
    title: "루틴 상기 알림",
    description: "반복되는 일정을 짧게 한 번 더 상기시킵니다.",
  },
  {
    key: "locationNotificationsEnabled",
    title: "위치 기반 보정",
    description: "앱에서만 일정 전후 시간대에 위치를 확인합니다.",
  },
];

export default function NotificationSettingsCard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [settings, setSettings] = useState<NotificationSettings>(
    getNotificationSettings
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSettings(getNotificationSettings());
    void loadRemoteSettings();
  }, []);

  async function getAccessToken() {
    if (!supabase) return null;

    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  async function loadRemoteSettings() {
    const accessToken = await getAccessToken();

    if (!accessToken) return;

    const response = await fetch("/api/notifications/settings", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return;

    const result = (await response.json()) as {
      ok: boolean;
      settings: NotificationSettings | null;
    };

    if (result.ok && result.settings) {
      setSettings(saveNotificationSettings(result.settings));
    }
  }

  async function save(nextSettings: NotificationSettings) {
    setSettings(saveNotificationSettings(nextSettings));
    setIsSaving(true);
    setMessage(null);

    const accessToken = await getAccessToken();

    if (accessToken) {
      await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(nextSettings),
      });

      const events = buildNotificationEvents(nextSettings);

      await fetch("/api/notifications/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ events }),
      });
    }

    setIsSaving(false);
    setMessage("알림 설정을 저장하고 예정 알림을 갱신했어.");
  }

  function updateSettings(nextPartial: Partial<NotificationSettings>) {
    const nextSettings = {
      ...settings,
      ...nextPartial,
      updatedAt: new Date().toISOString(),
    };

    void save(nextSettings);
  }

  async function sendTestNotification() {
    setMessage(null);

    try {
      const { Capacitor } = await import("@capacitor/core");

      if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import(
          "@capacitor/local-notifications"
        );
        const permission = await LocalNotifications.requestPermissions();

        if (permission.display !== "granted") {
          setMessage("아이폰 알림 권한을 허용해야 테스트 알림을 보낼 수 있어.");
          return;
        }

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: "나의 비서 테스트 알림",
              body: "알림이 정상으로 울리고 있어요.",
              schedule: {
                at: new Date(Date.now() + 5000),
              },
            },
          ],
        });
        setMessage("5초 뒤 아이폰 테스트 알림을 예약했어.");
        return;
      }
    } catch {
      // 웹에서는 브라우저 알림으로 이어서 처리합니다.
    }

    if (!("Notification" in window)) {
      setMessage("이 브라우저에서는 알림 테스트를 지원하지 않아.");
      return;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") {
      setMessage("알림 권한을 허용해야 테스트 알림을 보낼 수 있어.");
      return;
    }

    window.setTimeout(() => {
      new Notification("나의 비서 테스트 알림", {
        body: "알림이 정상으로 울리고 있어요.",
        icon: "/icons/icon-192.png",
      });
    }, 5000);
    setMessage("5초 뒤 브라우저 테스트 알림을 예약했어.");
  }

  async function sendServerPushTest() {
    setMessage(null);

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setMessage("앱 계정으로 로그인해야 서버 푸시를 테스트할 수 있어.");
      return;
    }

    const response = await fetch("/api/notifications/test-push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as {
      ok: boolean;
      sentCount?: number;
      failedCount?: number;
      webPushSubscriptionCount?: number;
      nativePushTokenCount?: number;
      apnsConfigured?: boolean;
      reason?: string | null;
    };

    if (!result.ok) {
      const statusText = `웹 푸시 ${result.webPushSubscriptionCount ?? 0}개 · 아이폰 앱 토큰 ${
        result.nativePushTokenCount ?? 0
      }개 · APNs ${result.apnsConfigured ? "설정됨" : "미설정"}`;
      setMessage(`${result.reason ?? "서버 푸시 테스트에 실패했어."} (${statusText})`);
      return;
    }

    setMessage(
      `서버 푸시를 보냈어. ${result.sentCount ?? 1}곳으로 발송했어. 웹 푸시 ${
        result.webPushSubscriptionCount ?? 0
      }개, 아이폰 앱 토큰 ${result.nativePushTokenCount ?? 0}개를 확인했어.`
    );
  }

  return (
    <section className="app-card p-5">
      <div>
        <p className="text-xs font-black text-blue-600">알림 엔진</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">알림 설정</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          일정 준비, 이동 시작, 재구매 추천, 루틴 상기를 한곳에서 관리합니다.
          위치 기반 보정은 앱에서만 제한적으로 사용합니다.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {TOGGLE_OPTIONS.map((option) => (
          <label
            key={option.key}
            className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
          >
            <span>
              <span className="block text-sm font-black text-slate-900">
                {option.title}
              </span>
              <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">
                {option.description}
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(settings[option.key])}
              onChange={(event) =>
                updateSettings({ [option.key]: event.target.checked })
              }
              className="h-5 w-5 shrink-0 accent-blue-600"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-black text-slate-500">
          준비 시작
          <input
            type="number"
            min="5"
            max="180"
            value={settings.defaultPrepLeadMinutes}
            onChange={(event) =>
              updateSettings({
                defaultPrepLeadMinutes: Number(event.target.value),
              })
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
          />
        </label>
        <label className="text-xs font-black text-slate-500">
          이동 여유
          <input
            type="number"
            min="0"
            max="60"
            value={settings.travelBufferMinutes}
            onChange={(event) =>
              updateSettings({
                travelBufferMinutes: Number(event.target.value),
              })
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
          />
        </label>
        <label className="text-xs font-black text-slate-500">
          위치 확인 범위
          <input
            type="number"
            min="15"
            max="240"
            value={settings.locationCheckWindowMinutes}
            onChange={(event) =>
              updateSettings({
                locationCheckWindowMinutes: Number(event.target.value),
              })
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={sendTestNotification}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
        >
          이 기기 알림 테스트
        </button>
        <button
          type="button"
          onClick={sendServerPushTest}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
        >
          서버 푸시 테스트
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
          {message}
        </p>
      )}
      {isSaving && (
        <p className="mt-3 text-xs font-bold text-slate-400">
          예정 알림을 갱신하는 중입니다.
        </p>
      )}
    </section>
  );
}
