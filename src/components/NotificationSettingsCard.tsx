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

const PERSISTENT_ALARM_OPTIONS: Array<{
  key: keyof Pick<
    NotificationSettings,
    | "persistentAlarmPrepEnabled"
    | "persistentAlarmTravelEnabled"
    | "persistentAlarmScheduleStartEnabled"
  >;
  title: string;
  description: string;
}> = [
  {
    key: "persistentAlarmPrepEnabled",
    title: "준비 시작",
    description: "일정 전 준비해야 하는 순간에 반복 알람을 울립니다.",
  },
  {
    key: "persistentAlarmTravelEnabled",
    title: "이동 시작",
    description: "장소가 있는 일정의 출발 확인 시점에 반복 알람을 울립니다.",
  },
  {
    key: "persistentAlarmScheduleStartEnabled",
    title: "중요 일정 시작",
    description: "일정 시작 시각에도 반복 알람을 울립니다.",
  },
];
const PERSISTENT_ALARM_ACTION_TYPE_ID = "persistent-alarm-actions";
const ALARM_MODE_EVENT = "my-assistant-open-alarm-mode";

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

    window.dispatchEvent(new Event("my-assistant-notification-settings-updated"));
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
              sound: "default",
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

  async function sendPersistentAlarmTest() {
    setMessage(null);

    try {
      const { Capacitor } = await import("@capacitor/core");

      if (!Capacitor.isNativePlatform()) {
        setMessage("지속 알람 테스트는 아이폰 앱에서 확인할 수 있어.");
        return;
      }

      const { LocalNotifications } = await import(
        "@capacitor/local-notifications"
      );
      const permission = await LocalNotifications.requestPermissions();

      if (permission.display !== "granted") {
        setMessage("아이폰 알림 권한을 허용해야 지속 알람을 테스트할 수 있어.");
        return;
      }

      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: PERSISTENT_ALARM_ACTION_TYPE_ID,
            actions: [
              {
                id: "confirm",
                title: "확인",
                foreground: true,
              },
              {
                id: "snooze",
                title: "5분 미루기",
              },
              {
                id: "mute_today",
                title: "오늘 끄기",
                destructive: true,
              },
            ],
          },
        ],
      });

      const now = Date.now();
      const originalEventId = `persistent-test-${now}`;

      await LocalNotifications.schedule({
        notifications: [0, 1, 2].map((index) => ({
          id: (now + index) % 2147483647,
          title:
            index === 0
              ? "나의 비서 지속 알람 테스트"
              : `나의 비서 지속 알람 테스트 (${index + 1}번째)`,
          body: "확인하지 않으면 반복해서 울리는 알람 흐름을 확인합니다.",
          sound: "default",
          schedule: {
            at: new Date(now + 5000 + index * 10000),
          },
          actionTypeId: PERSISTENT_ALARM_ACTION_TYPE_ID,
          extra: {
            url: "/settings",
            originalEventId,
            eventType: "prep_start",
            persistentAlarm: true,
          },
        })),
      });
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(ALARM_MODE_EVENT, {
            detail: {
              title: "나의 비서 지속 알람 테스트",
              body: "알림을 누르면 이런 전체 화면 알람으로 이어집니다.",
              url: "/settings",
              originalEventId,
              eventType: "prep_start",
            },
          })
        );
      }, 5000);
      setMessage(
        "5초 뒤 전체 화면 알람과 10초 간격 반복 알림 테스트를 함께 예약했어."
      );
    } catch {
      setMessage("지속 알람 테스트 예약에 실패했어.");
    }
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
      webSentCount?: number;
      nativeSentCount?: number;
      failedCount?: number;
      webFailedCount?: number;
      nativeFailedCount?: number;
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
      `서버 푸시를 보냈어. 전체 ${result.sentCount ?? 1}곳으로 발송했어. 웹 발송 ${
        result.webSentCount ?? 0
      }개, 아이폰 앱 발송 ${result.nativeSentCount ?? 0}개. 연결 상태는 웹 푸시 ${
        result.webPushSubscriptionCount ?? 0
      }개, 아이폰 앱 토큰 ${result.nativePushTokenCount ?? 0}개야.`
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

      <div className="mt-5 rounded-3xl bg-slate-950 p-4 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-200">지속 알람</p>
            <h3 className="mt-1 text-base font-black">움직여야 할 때 반복해서 울리기</h3>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300">
              푸시는 상기용, 지속 알람은 준비와 이동처럼 바로 행동해야 하는
              순간에 사용합니다.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.persistentAlarmEnabled}
            onChange={(event) =>
              updateSettings({ persistentAlarmEnabled: event.target.checked })
            }
            className="mt-1 h-5 w-5 shrink-0 accent-blue-400"
          />
        </div>

        <div className="mt-4 grid gap-2">
          {PERSISTENT_ALARM_OPTIONS.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 p-3"
            >
              <span>
                <span className="block text-sm font-black">{option.title}</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-slate-300">
                  {option.description}
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings[option.key])}
                disabled={!settings.persistentAlarmEnabled}
                onChange={(event) =>
                  updateSettings({ [option.key]: event.target.checked })
                }
                className="h-5 w-5 shrink-0 accent-blue-400 disabled:opacity-40"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-black text-slate-300">
            반복 간격(분)
            <input
              type="number"
              min="1"
              max="10"
              value={settings.persistentAlarmIntervalMinutes}
              disabled={!settings.persistentAlarmEnabled}
              onChange={(event) =>
                updateSettings({
                  persistentAlarmIntervalMinutes: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-300 disabled:opacity-40"
            />
          </label>
          <label className="text-xs font-black text-slate-300">
            반복 횟수
            <input
              type="number"
              min="1"
              max="10"
              value={settings.persistentAlarmRepeatCount}
              disabled={!settings.persistentAlarmEnabled}
              onChange={(event) =>
                updateSettings({
                  persistentAlarmRepeatCount: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-blue-300 disabled:opacity-40"
            />
          </label>
        </div>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={sendTestNotification}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
        >
          로컬 알림 테스트
        </button>
        <button
          type="button"
          onClick={sendPersistentAlarmTest}
          className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white"
        >
          지속 알람 테스트
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
