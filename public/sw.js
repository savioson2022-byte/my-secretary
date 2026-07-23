self.addEventListener("push", (event) => {
  let data = {
    title: "나의 비서",
    body: "확인할 일정이 있어요.",
    url: "/",
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || data.title,
      silent: Boolean(data.silent),
      requireInteraction: data.requireInteraction !== false,
      renotify: true,
      vibrate: [700, 180, 700, 180, 900],
      actions: data.data?.persistentAlarm
        ? [
            { action: "open-alarm", title: "알람 확인" },
            { action: "snooze", title: "나중에 확인" },
          ]
        : [],
      data: {
        url: data.url || "/",
        ...(data.data || {}),
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  );
  if (event.notification.data?.persistentAlarm) {
    target.searchParams.set("alarm", "1");
    target.searchParams.set(
      "alarmGroupId",
      event.notification.data?.persistentAlarmGroupId || ""
    );
    target.searchParams.set(
      "alarmEventType",
      event.notification.data?.eventType || ""
    );
    target.searchParams.set("alarmTitle", event.notification.title || "");
    target.searchParams.set("alarmBody", event.notification.body || "");
    target.searchParams.set("alarmAction", event.action || "open-alarm");
  }
  const targetUrl = target.href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});
