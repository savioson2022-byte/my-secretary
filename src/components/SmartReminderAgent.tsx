"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNotificationEvents } from "@/lib/notificationEventBuilder";
import { getNotificationSettings } from "@/lib/notificationSettingsStorage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { getSingleSchedules } from "@/lib/singleScheduleStorage";
import { getItems } from "@/lib/storage";
import { getUserProfile } from "@/lib/userProfileStorage";
import type { NotificationEvent } from "@/types/notification";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";

const REMINDER_OFFSETS = [10, 0];
const NOTIFIED_KEY = "my-assistant-notified-reminders";
const DIGEST_NOTIFIED_KEY = "my-assistant-notified-unresolved-digests";
const NATIVE_SCHEDULED_KEY = "my-assistant-native-notification-event-ids";
const PUSH_SYNC_DAYS = 14;
const UNRESOLVED_DIGEST_HOURS = [8, 20];
const LOCATION_DISTANCE_THRESHOLD_METERS = 300;

type PushScheduleEntry = {
  sourceType: "single" | "routine";
  sourceId: string;
  occurrenceDate: string;
  startTime: string;
  title: string;
  placeName: string;
  reminderOffsets: number[];
  timezone: string;
};

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayOfWeek(date: Date): DayOfWeek {
  return ["일", "월", "화", "수", "목", "금", "토"][
    date.getDay()
  ] as DayOfWeek;
}

function getDateTime(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function isRoutineActiveToday(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;
  if (routine.startDate && routine.startDate > dateText) return false;
  if (routine.endDate && routine.endDate < dateText) return false;
  if (routine.cancelledDates?.includes(dateText)) return false;

  return true;
}

function getNotifiedIds() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  const recentIds = Array.from(ids).slice(-200);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(recentIds));
}

function getDigestNotifiedIds() {
  try {
    return new Set<string>(
      JSON.parse(localStorage.getItem(DIGEST_NOTIFIED_KEY) ?? "[]")
    );
  } catch {
    return new Set<string>();
  }
}

function saveDigestNotifiedIds(ids: Set<string>) {
  const recentIds = Array.from(ids).slice(-100);
  localStorage.setItem(DIGEST_NOTIFIED_KEY, JSON.stringify(recentIds));
}

function showReminder(title: string, body: string, url = "/") {
  if ("vibrate" in navigator) {
    navigator.vibrate([160, 80, 160]);
  }

  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: title,
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
    };
    return;
  }

  window.alert(`${title}\n${body}`);
}

function getNumericNotificationId(id: string) {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }

  return Math.max(1, hash % 2147483647);
}

function getDistanceMeters({
  fromLatitude,
  fromLongitude,
  toLatitude,
  toLongitude,
}: {
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
}) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const latitude1 = toRadians(fromLatitude);
  const latitude2 = toRadians(toLatitude);
  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function isNativeAppRuntime() {
  try {
    const { Capacitor } = await import("@capacitor/core");

    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function getUpcomingScheduleEntries() {
  const singleSchedules = getSingleSchedules();
  const routineSchedules = getRoutineSchedules();
  const today = new Date();
  const entries: PushScheduleEntry[] = [];

  for (let dayOffset = 0; dayOffset < PUSH_SYNC_DAYS; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    const dateText = toDateText(date);
    const dayOfWeek = getDayOfWeek(date);

    singleSchedules
      .filter((schedule) => schedule.date === dateText)
      .forEach((schedule) => {
        entries.push({
          sourceType: "single",
          sourceId: schedule.id,
          occurrenceDate: schedule.date,
          startTime: schedule.startTime,
          title: schedule.title,
          placeName: schedule.placeName,
          reminderOffsets: REMINDER_OFFSETS,
          timezone: "Asia/Seoul",
        });
      });

    routineSchedules
      .filter((routine) => {
        return (
          routine.dayOfWeek === dayOfWeek &&
          isRoutineActiveToday(routine, dateText)
        );
      })
      .forEach((routine) => {
        entries.push({
          sourceType: "routine",
          sourceId: routine.id,
          occurrenceDate: dateText,
          startTime: routine.startTime,
          title: routine.title,
          placeName: routine.placeName,
          reminderOffsets: REMINDER_OFFSETS,
          timezone: "Asia/Seoul",
        });
      });
  }

  return entries;
}

function checkDueReminders() {
  const now = new Date();
  const todayText = toDateText(now);
  const dayOfWeek = getDayOfWeek(now);
  const notifiedIds = getNotifiedIds();

  const singleEvents = getSingleSchedules()
    .filter((schedule) => schedule.date === todayText)
    .map((schedule) => ({
      id: `single-${schedule.id}`,
      title: schedule.title,
      time: schedule.startTime,
      placeName: schedule.placeName,
      dateText: schedule.date,
    }));

  const routineEvents = getRoutineSchedules()
    .filter((routine) => {
      return (
        routine.dayOfWeek === dayOfWeek &&
        isRoutineActiveToday(routine, todayText)
      );
    })
    .map((routine) => ({
      id: `routine-${routine.id}-${todayText}`,
      title: routine.title,
      time: routine.startTime,
      placeName: routine.placeName,
      dateText: todayText,
    }));

  [...singleEvents, ...routineEvents].forEach((event) => {
    const startAt = getDateTime(event.dateText, event.time).getTime();

    REMINDER_OFFSETS.forEach((offsetMinutes) => {
      const reminderAt = startAt - offsetMinutes * 60 * 1000;
      const diff = now.getTime() - reminderAt;
      const notifyId = `${event.id}-${offsetMinutes}`;

      if (diff < 0 || diff > 60 * 1000 || notifiedIds.has(notifyId)) {
        return;
      }

      notifiedIds.add(notifyId);
      showReminder(
        offsetMinutes === 0
          ? `${event.title} 시작 시간이에요`
          : `${event.title} ${offsetMinutes}분 전이에요`,
        `${event.time}${event.placeName ? ` · ${event.placeName}` : ""}`
      );
    });
  });

  saveNotifiedIds(notifiedIds);
}

function getUnresolvedActionItems() {
  return getItems().filter((item) => {
    if (item.status !== "미완료") return false;

    const isIncompleteSingleSchedule =
      item.processType === "단기일정" &&
      (!item.dueDate || !item.scheduleStartTime);
    const isInstantAction =
      item.processType === "즉시처리" ||
      item.actionType === "구매" ||
      item.actionType === "예약" ||
      item.actionType === "연락";

    return isIncompleteSingleSchedule || isInstantAction;
  });
}

function checkUnresolvedDigest() {
  const profile = getUserProfile();

  if (profile?.unresolvedDigestEnabled === false) return;

  if (
    profile?.unresolvedDigestSnoozedUntil &&
    new Date(profile.unresolvedDigestSnoozedUntil).getTime() > Date.now()
  ) {
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (!UNRESOLVED_DIGEST_HOURS.includes(currentHour) || currentMinute > 10) {
    return;
  }

  const unresolvedItems = getUnresolvedActionItems();

  if (unresolvedItems.length === 0) return;

  const digestIds = getDigestNotifiedIds();
  const digestId = `${toDateText(now)}-${currentHour}`;

  if (digestIds.has(digestId)) return;

  digestIds.add(digestId);
  showReminder(
    "확정 안 된 일이 있어요",
    `${unresolvedItems.length}개의 단기일정/즉시처리를 오늘 정리하면 좋아요.`
  );
  saveDigestNotifiedIds(digestIds);
}

async function shouldShowLocationEvent(event: NotificationEvent) {
  if (!event.requiresLocationCheck || !event.latitude || !event.longitude) {
    return true;
  }

  if (!(await isNativeAppRuntime())) {
    return true;
  }

  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permission = await Geolocation.requestPermissions();

    if (permission.location !== "granted") {
      return true;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
    });
    const distanceMeters = getDistanceMeters({
      fromLatitude: position.coords.latitude,
      fromLongitude: position.coords.longitude,
      toLatitude: event.latitude,
      toLongitude: event.longitude,
    });

    return distanceMeters > LOCATION_DISTANCE_THRESHOLD_METERS;
  } catch {
    return true;
  }
}

async function checkDueNotificationEvents(events: NotificationEvent[]) {
  const now = Date.now();
  const notifiedIds = getNotifiedIds();
  const dueEvents = events.filter((event) => {
    const scheduledAt = new Date(event.scheduledAt).getTime();

    return (
      scheduledAt <= now &&
      scheduledAt > now - 60 * 1000 &&
      !notifiedIds.has(event.id)
    );
  });

  for (const event of dueEvents) {
    const shouldShow = await shouldShowLocationEvent(event);

    notifiedIds.add(event.id);

    if (!shouldShow) {
      continue;
    }

    showReminder(event.title, event.body, event.url);
  }

  saveNotifiedIds(notifiedIds);
}

function getStoredNativeNotificationIds() {
  try {
    return (JSON.parse(
      localStorage.getItem(NATIVE_SCHEDULED_KEY) ?? "[]"
    ) ?? []) as number[];
  } catch {
    return [];
  }
}

function saveStoredNativeNotificationIds(ids: number[]) {
  localStorage.setItem(NATIVE_SCHEDULED_KEY, JSON.stringify(ids.slice(0, 128)));
}

async function scheduleNativeNotifications(events: NotificationEvent[]) {
  if (!(await isNativeAppRuntime())) {
    return;
  }

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    const permission = await LocalNotifications.requestPermissions();

    if (permission.display !== "granted") {
      return;
    }

    const previousIds = getStoredNativeNotificationIds();

    if (previousIds.length > 0) {
      await LocalNotifications.cancel({
        notifications: previousIds.map((id) => ({ id })),
      });
    }

    const now = Date.now();
    const notifications = events
      .filter((event) => new Date(event.scheduledAt).getTime() > now)
      .slice(0, 64)
      .map((event) => ({
        id: getNumericNotificationId(event.id),
        title: event.title,
        body: event.body,
        schedule: {
          at: new Date(event.scheduledAt),
        },
        extra: {
          url: event.url,
          eventId: event.id,
        },
      }));

    if (notifications.length === 0) {
      saveStoredNativeNotificationIds([]);
      return;
    }

    await LocalNotifications.schedule({ notifications });
    saveStoredNativeNotificationIds(
      notifications.map((notification) => notification.id)
    );
  } catch {
    // 웹/PWA에서는 Capacitor 로컬 알림을 사용할 수 없으므로 조용히 건너뜁니다.
  }
}

export default function SmartReminderAgent() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isMounted, setIsMounted] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "none">(
    "none"
  );
  const [message, setMessage] = useState<string | null>(null);
  const canUseNotification = useMemo(() => {
    return isMounted && "Notification" in window;
  }, [isMounted]);
  const canUsePush = useMemo(() => {
    return (
      isMounted &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }, [isMounted]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!canUseNotification) return;

    setPermission(Notification.permission);
    const settings = getNotificationSettings();
    const events = buildNotificationEvents(settings);

    void checkDueNotificationEvents(events);
    checkUnresolvedDigest();
    void scheduleNativeNotifications(events);

    const timer = window.setInterval(() => {
      const nextSettings = getNotificationSettings();
      const nextEvents = buildNotificationEvents(nextSettings);

      void checkDueNotificationEvents(nextEvents);
      checkUnresolvedDigest();
    }, 30 * 1000);

    return () => window.clearInterval(timer);
  }, [canUseNotification]);

  useEffect(() => {
    if (!canUseNotification || Notification.permission !== "granted") return;

    enableServerPush();
  }, [canUseNotification, canUsePush, supabase]);

  async function requestPermission() {
    if (!canUseNotification) {
      alert("이 브라우저에서는 알림 권한을 지원하지 않습니다.");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);

    if (nextPermission === "granted") {
      showReminder("나의 비서 알림이 켜졌어요", "일정 시간이 되면 알려드릴게요.");
      await enableServerPush();
    }
  }

  async function getAccessToken() {
    if (!supabase) return null;

    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  async function enableServerPush() {
    if (!canUsePush) {
      setMessage("이 브라우저는 서버 푸시를 지원하지 않습니다.");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      setMessage("서버 푸시 공개키가 아직 설정되지 않았습니다.");
      return;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setMessage("로그인 후 서버 푸시를 연결할 수 있습니다.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existingSubscription =
        await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const subscribeResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceName: "나의 기기",
        }),
      });
      const subscribeResult = await subscribeResponse.json();

      if (!subscribeResult.ok) {
        setMessage(subscribeResult.reason ?? "푸시 구독 저장에 실패했습니다.");
        return;
      }

      const settings = getNotificationSettings();
      const events = buildNotificationEvents(settings);

      await syncNotificationEvents(accessToken, events);
      await scheduleNativeNotifications(events);
      await syncPushSchedules(accessToken);
      setMessage("서버 푸시 알림을 연결했습니다.");
    } catch {
      setMessage("서버 푸시 연결에 실패했습니다.");
    }
  }

  async function syncPushSchedules(accessToken?: string) {
    const token = accessToken ?? (await getAccessToken());

    if (!token) return;

    const entries = getUpcomingScheduleEntries();

    if (entries.length === 0) return;

    await fetch("/api/push/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entries }),
    });
  }

  async function syncNotificationEvents(
    accessToken?: string,
    events = buildNotificationEvents(getNotificationSettings())
  ) {
    const token = accessToken ?? (await getAccessToken());

    if (!token || events.length === 0) return;

    await fetch("/api/notifications/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });
  }

  if (!canUseNotification || permission === "granted") {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[430px] rounded-3xl bg-slate-950 p-4 text-white shadow-[0_24px_70px_rgba(15,23,42,0.35)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">일정 알림 켜기</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/68">
            앱이 실행 중이면 바로 알려주고, 지원되는 기기는 서버 푸시도
            연결합니다.
          </p>
          {message && (
            <p className="mt-1 text-xs font-bold leading-5 text-white/80">
              {message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={requestPermission}
          className="shrink-0 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
        >
          켜기
        </button>
      </div>
    </div>
  );
}
