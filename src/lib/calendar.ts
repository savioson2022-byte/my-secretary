import { AssistantItem } from "@/types/assistant";

type CalendarEventOptions = {
  item: AssistantItem;
  startDateTime: string;
  durationMinutes?: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateToICS(date: Date) {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeICSText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function createDescription(item: AssistantItem) {
  return [
    `원문: ${item.originalText}`,
    `분야: ${item.category}`,
    `행동 유형: ${item.actionType}`,
    `중요도: ${item.priority}`,
    `반복성: ${item.repeatType}`,
    `상태: ${item.status}`,
  ].join("\n");
}

function createFileName(title: string) {
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 30);
}

export function createICSContent({
  item,
  startDateTime,
  durationMinutes = 60,
}: CalendarEventOptions) {
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();

  const uid = `${item.id}@na-ui-biseo`;
  const title = escapeICSText(item.title);
  const description = escapeICSText(createDescription(item));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Na-ui Biseo//Assistant Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateToICS(now)}`,
    `DTSTART:${formatDateToICS(start)}`,
    `DTEND:${formatDateToICS(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `CATEGORIES:${escapeICSText(item.category)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

export function downloadICSFile(item: AssistantItem, startDateTime: string) {
  const icsContent = createICSContent({
    item,
    startDateTime,
    durationMinutes: 60,
  });

  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${createFileName(item.title) || "calendar-event"}.ics`;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
