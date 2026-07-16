"use client";

import { useEffect, useMemo, useState } from "react";

const ALARM_MODE_EVENT = "my-assistant-open-alarm-mode";
const PERSISTENT_ALARM_MUTED_KEY = "my-assistant-persistent-alarm-muted-event-ids";
const PERSISTENT_ALARM_ACTION_TYPE_ID = "persistent-alarm-actions";

type AlarmModeDetail = {
  title?: string;
  body?: string;
  url?: string;
  originalEventId?: string;
  eventType?: string;
  sourceLabel?: string;
};

function getMutedIds() {
  try {
    return new Set<string>(
      JSON.parse(localStorage.getItem(PERSISTENT_ALARM_MUTED_KEY) ?? "[]")
    );
  } catch {
    return new Set<string>();
  }
}

function saveMutedIds(ids: Set<string>) {
  const recentIds = Array.from(ids).slice(-100);

  localStorage.setItem(PERSISTENT_ALARM_MUTED_KEY, JSON.stringify(recentIds));
}

function getNumericNotificationId(id: string) {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return Math.max(1, hash % 2147483647);
}

function getAlarmLabel(eventType?: string) {
  if (eventType === "travel_start") return "이동 시작";
  if (eventType === "schedule_start") return "일정 시작";
  if (eventType === "prep_start") return "준비 시작";

  return "지속 알람";
}

async function scheduleSnoozeAlarm(alarm: AlarmModeDetail) {
  const originalEventId =
    alarm.originalEventId ?? `overlay-alarm-${Date.now().toString()}`;

  try {
    const { Capacitor } = await import("@capacitor/core");

    if (!Capacitor.isNativePlatform()) return;

    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    await LocalNotifications.schedule({
      notifications: [
        {
          id: getNumericNotificationId(`${originalEventId}:overlay-snooze:${Date.now()}`),
          title: `${alarm.title ?? "나의 비서 알람"} · 5분 뒤 다시 알림`,
          body: alarm.body ?? "다시 확인할 시간이 되었어요.",
          sound: "default",
          schedule: {
            at: new Date(Date.now() + 5 * 60 * 1000),
          },
          actionTypeId: PERSISTENT_ALARM_ACTION_TYPE_ID,
          extra: {
            url: alarm.url ?? "/",
            originalEventId,
            persistentAlarm: true,
            eventType: alarm.eventType,
          },
        },
      ],
    });
  } catch {
    // 앱이 아닌 환경에서는 화면 알람만 닫습니다.
  }
}

export default function AlarmModeOverlay() {
  const [alarm, setAlarm] = useState<AlarmModeDetail | null>(null);
  const [now, setNow] = useState(() => new Date());
  const alarmLabel = useMemo(() => getAlarmLabel(alarm?.eventType), [alarm]);

  useEffect(() => {
    const handleOpenAlarmMode = (event: Event) => {
      const nextAlarm = (event as CustomEvent<AlarmModeDetail>).detail ?? {};
      setAlarm(nextAlarm);
    };

    window.addEventListener(ALARM_MODE_EVENT, handleOpenAlarmMode);

    return () => {
      window.removeEventListener(ALARM_MODE_EVENT, handleOpenAlarmMode);
    };
  }, []);

  useEffect(() => {
    if (!alarm) return;

    const clockId = window.setInterval(() => setNow(new Date()), 1000);
    const vibrationId = window.setInterval(() => {
      if ("vibrate" in navigator) {
        navigator.vibrate([450, 180, 450]);
      }
    }, 2500);

    if ("vibrate" in navigator) {
      navigator.vibrate([450, 180, 450]);
    }

    return () => {
      window.clearInterval(clockId);
      window.clearInterval(vibrationId);
      if ("vibrate" in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [alarm]);

  if (!alarm) return null;

  const timeText = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const closeAndOpenTarget = () => {
    const targetUrl = alarm.url ?? "/";
    setAlarm(null);
    window.location.href = targetUrl;
  };

  const snooze = async () => {
    await scheduleSnoozeAlarm(alarm);
    setAlarm(null);
  };

  const muteToday = () => {
    if (alarm.originalEventId) {
      const mutedIds = getMutedIds();
      mutedIds.add(alarm.originalEventId);
      saveMutedIds(mutedIds);
    }

    setAlarm(null);
  };

  return (
    <section
      className="fixed inset-0 z-[1000] flex min-h-screen flex-col bg-[#07101F] text-white"
      style={{
        paddingTop: "max(28px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="나의 비서 지속 알람"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(49,130,246,0.34),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0),_rgba(15,23,42,0.88))]" />
      <div className="relative flex flex-1 flex-col px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold text-blue-200">나의 비서 알람</p>
            <p className="mt-1 text-xs font-bold text-white/55">{alarmLabel}</p>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black">
            {timeText}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-8 h-2 w-20 rounded-full bg-blue-400 shadow-[0_0_26px_rgba(96,165,250,0.9)]" />
          <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-200/80">
            Action Needed
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal sm:text-6xl">
            {alarm.title ?? "지금 확인할 알람이 있어요"}
          </h1>
          {alarm.body ? (
            <p className="mt-6 whitespace-pre-line text-lg font-bold leading-relaxed text-slate-200">
              {alarm.body}
            </p>
          ) : null}
          <p className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-4 text-sm font-bold leading-relaxed text-slate-200">
            앱을 닫지 않고 바로 처리할 수 있게 알람 화면을 고정했어요. 지금 시작하거나,
            5분 뒤 다시 알림으로 미룰 수 있습니다.
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={closeAndOpenTarget}
            className="h-16 rounded-[28px] bg-white text-lg font-black text-slate-950 shadow-[0_18px_48px_rgba(255,255,255,0.2)]"
          >
            지금 시작
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={snooze}
              className="h-14 rounded-[24px] border border-white/15 bg-white/10 text-base font-black text-white"
            >
              5분 미루기
            </button>
            <button
              type="button"
              onClick={muteToday}
              className="h-14 rounded-[24px] border border-white/15 bg-white/5 text-base font-black text-white/80"
            >
              오늘 끄기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
