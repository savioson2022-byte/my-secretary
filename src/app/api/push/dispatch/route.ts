import { NextRequest, NextResponse } from "next/server";
import {
  isApnsConfigured,
  sendApplePushNotification,
} from "@/lib/apns";
import { sendPushNotification } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ScheduleEntryRecord = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  occurrence_date: string;
  start_time: string;
  title: string;
  place_name: string;
  reminder_offsets: number[];
};

type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NativePushTokenRecord = {
  id: string;
  user_id: string;
  token: string;
};

type NotificationEventRecord = {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  body: string;
  url: string;
  scheduled_at: string;
  delivery_channels: string[];
  sound_enabled: boolean;
  require_interaction: boolean;
  priority: string;
  payload: Record<string, unknown>;
};

function getKoreanTodayText() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function getKoreanMinutesOfDay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0
  );

  return hour * 60 + minute;
}

function timeToMinutes(timeText: string) {
  const [hourText, minuteText] = timeText.split(":");

  return Number(hourText) * 60 + Number(minuteText);
}

function getDispatchWindow() {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(windowStart.getMinutes() - 5);

  return {
    nowIso: now.toISOString(),
    windowStartIso: windowStart.toISOString(),
  };
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function sendNativePushesForEvent({
  supabase,
  event,
}: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  event: NotificationEventRecord;
}) {
  if (!isApnsConfigured()) {
    return 0;
  }

  if (!event.delivery_channels.includes("native_push")) {
    return 0;
  }

  const { data: nativeTokens, error } = await supabase
    .from("native_push_tokens")
    .select("*")
    .eq("user_id", event.user_id)
    .eq("enabled", true)
    .returns<NativePushTokenRecord[]>();

  if (error) {
    return 0;
  }

  let sentCount = 0;

  for (const nativeToken of nativeTokens ?? []) {
    const { data: existingDelivery } = await supabase
      .from("native_notification_event_deliveries")
      .select("id")
      .eq("event_id", event.id)
      .eq("native_token_id", nativeToken.id)
      .maybeSingle<{ id: string }>();

    if (existingDelivery) {
      continue;
    }

    try {
      await sendApplePushNotification({
        token: nativeToken.token,
        title: event.title,
        body: event.body,
        url: event.url,
        tag: event.id,
        soundEnabled: event.sound_enabled,
        timeSensitive:
          event.priority === "urgent" || event.require_interaction,
      });

      await supabase.from("native_notification_event_deliveries").insert({
        user_id: event.user_id,
        event_id: event.id,
        native_token_id: nativeToken.id,
      });
      sentCount += 1;
    } catch {
      await supabase
        .from("native_push_tokens")
        .update({
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nativeToken.id);
    }
  }

  return sentCount;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, reason: "권한이 없습니다." },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        reason: "SUPABASE_SERVICE_ROLE_KEY가 설정되어야 서버 푸시를 보낼 수 있습니다.",
      },
      { status: 500 }
    );
  }

  const todayText = getKoreanTodayText();
  const nowMinutes = getKoreanMinutesOfDay();
  const { nowIso, windowStartIso } = getDispatchWindow();
  let sentCount = 0;
  let skippedCount = 0;

  const { data: scheduleEntries, error: scheduleEntriesError } = await supabase
    .from("notification_schedule_entries")
    .select("*")
    .eq("active", true)
    .eq("occurrence_date", todayText)
    .returns<ScheduleEntryRecord[]>();

  if (scheduleEntriesError) {
    return NextResponse.json(
      { ok: false, reason: scheduleEntriesError.message },
      { status: 500 }
    );
  }

  const { data: notificationEvents } = await supabase
    .from("notification_events")
    .select("*")
    .eq("active", true)
    .lte("scheduled_at", nowIso)
    .gte("scheduled_at", windowStartIso)
    .returns<NotificationEventRecord[]>();

  for (const event of notificationEvents ?? []) {
    const webPushEnabled = event.delivery_channels.includes("web_push");
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", event.user_id)
      .eq("enabled", true)
      .returns<PushSubscriptionRecord[]>();

    for (const subscription of subscriptions ?? []) {
      if (!webPushEnabled) break;
      const { data: existingDelivery } = await supabase
        .from("notification_event_deliveries")
        .select("id")
        .eq("event_id", event.id)
        .eq("subscription_id", subscription.id)
        .maybeSingle<{ id: string }>();

      if (existingDelivery) {
        continue;
      }

      try {
        await sendPushNotification({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          title: event.title,
          body: event.body,
          url: event.url,
          tag: event.id,
          silent: !event.sound_enabled,
          requireInteraction: event.require_interaction,
          data: {
            ...event.payload,
            eventType: event.event_type,
            persistentAlarm:
              event.payload?.persistentAlarm === true ||
              event.require_interaction,
          },
        });

        await supabase.from("notification_event_deliveries").insert({
          user_id: event.user_id,
          event_id: event.id,
          subscription_id: subscription.id,
        });
        sentCount += 1;
      } catch {
        await supabase
          .from("push_subscriptions")
          .update({
            enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      }
    }

    sentCount += await sendNativePushesForEvent({ supabase, event });
  }

  for (const entry of scheduleEntries ?? []) {
    const startMinutes = timeToMinutes(entry.start_time);
    const dueOffsets = entry.reminder_offsets.filter((offset) => {
      const dueMinutes = startMinutes - offset;
      return nowMinutes >= dueMinutes && nowMinutes < dueMinutes + 5;
    });

    if (dueOffsets.length === 0) {
      skippedCount += 1;
      continue;
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", entry.user_id)
      .eq("enabled", true)
      .returns<PushSubscriptionRecord[]>();

    for (const subscription of subscriptions ?? []) {
      for (const offsetMinutes of dueOffsets) {
        const { data: existingDelivery } = await supabase
          .from("notification_deliveries")
          .select("id")
          .eq("schedule_entry_id", entry.id)
          .eq("subscription_id", subscription.id)
          .eq("offset_minutes", offsetMinutes)
          .maybeSingle<{ id: string }>();

        if (existingDelivery) {
          continue;
        }

        try {
          await sendPushNotification({
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            title:
              offsetMinutes === 0
                ? `${entry.title} 시작 시간이에요`
                : `${entry.title} ${offsetMinutes}분 전이에요`,
            body: `${entry.start_time.slice(0, 5)}${
              entry.place_name ? ` · ${entry.place_name}` : ""
            }`,
            url: "/calendar/weekly",
            tag: `${entry.id}-${offsetMinutes}`,
          });

          await supabase.from("notification_deliveries").insert({
            user_id: entry.user_id,
            schedule_entry_id: entry.id,
            subscription_id: subscription.id,
            offset_minutes: offsetMinutes,
          });
          sentCount += 1;
        } catch {
          await supabase
            .from("push_subscriptions")
            .update({
              enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sentCount,
    skippedCount,
    checkedCount:
      (scheduleEntries?.length ?? 0) + (notificationEvents?.length ?? 0),
  });
}
