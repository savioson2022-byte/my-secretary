"use client";

import type { ReactNode } from "react";
import { AssistantItem } from "@/types/assistant";
import CalendarAddButton from "./CalendarAddButton";

type ItemCardProps = {
  item: AssistantItem;
  onComplete: (item: AssistantItem) => void;
  onDelete: (id: string) => void;
};

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
      {children}
    </span>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getScheduleText(item: AssistantItem) {
  if (!item.scheduleStartTime && !item.scheduleEndTime) return null;

  return [item.scheduleStartTime, item.scheduleEndTime]
    .filter(Boolean)
    .join(" - ");
}

export default function ItemCard({ item, onComplete, onDelete }: ItemCardProps) {
  const isDone = item.status === "완료";
  const scheduleText = getScheduleText(item);

  return (
    <article
      className={`app-card p-4 ${
        isDone ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className={`text-base font-black text-slate-900 ${
              isDone ? "line-through" : ""
            }`}
          >
            {item.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            생성일 {formatDate(item.createdAt)}
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-600">
          {item.status}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
        {item.originalText}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{item.category}</Badge>
        <Badge>{item.repeatType}</Badge>
        <Badge>{item.actionType}</Badge>
        <Badge>중요도 {item.priority}</Badge>
        {item.ideaGroupTitle && <Badge>묶음 {item.ideaGroupTitle}</Badge>}
        {item.ideaSubcategory && <Badge>{item.ideaSubcategory}</Badge>}
        {scheduleText && <Badge>시간 {scheduleText}</Badge>}
        {item.dueDate && <Badge>마감 {item.dueDate}</Badge>}
        {item.reminderDate && <Badge>알림 {item.reminderDate}</Badge>}
      </div>

      <CalendarAddButton item={item} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onComplete(item)}
          disabled={isDone}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          완료
        </button>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          삭제
        </button>
      </div>
    </article>
  );
}
