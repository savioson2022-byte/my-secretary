"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNotificationEvents } from "@/lib/notificationEventBuilder";
import { getNotificationSettings } from "@/lib/notificationSettingsStorage";
import type { NotificationEvent } from "@/types/notification";

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(isoText: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoText));
}

function getEventLabel(event: NotificationEvent) {
  switch (event.eventType) {
    case "prep_start":
      return "준비";
    case "travel_start":
      return "이동";
    case "purchase_recommendation":
      return "구매";
    case "routine_reminder":
      return "루틴";
    case "place_arrival_reminder":
      return "도착";
    default:
      return "일정";
  }
}

export default function NotificationSummaryCard() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const todayText = useMemo(() => toDateText(new Date()), []);
  const todayEvents = useMemo(() => {
    return events
      .filter((event) => event.occurrenceDate === todayText)
      .slice(0, 5);
  }, [events, todayText]);

  useEffect(() => {
    setEvents(buildNotificationEvents(getNotificationSettings()));
  }, []);

  if (todayEvents.length === 0) {
    return null;
  }

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-blue-600">오늘의 알림</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">
            자동으로 챙길 알림
          </h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
          {todayEvents.length}개
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {todayEvents.map((event) => (
          <a
            key={event.id}
            href={event.url}
            className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
          >
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
              {getEventLabel(event)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-slate-900">
                {event.title}
              </span>
              <span className="mt-1 block text-xs font-bold text-slate-500">
                {formatTime(event.scheduledAt)}
                {event.placeName ? ` · ${event.placeName}` : ""}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
