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
