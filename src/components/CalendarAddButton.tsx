"use client";

import { useMemo, useState } from "react";
import { AssistantItem } from "@/types/assistant";
import { downloadICSFile } from "../lib/calendar";

type CalendarAddButtonProps = {
  item: AssistantItem;
};

function toDateTimeLocalValue(dateText: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return `${dateText}T09:00`;
  }

  return dateText.slice(0, 16);
}

export default function CalendarAddButton({ item }: CalendarAddButtonProps) {
  const defaultDateTime = useMemo(() => {
    if (item.dueDate) return toDateTimeLocalValue(item.dueDate);
    if (item.reminderDate) return toDateTimeLocalValue(item.reminderDate);
    return "";
  }, [item.dueDate, item.reminderDate]);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState(defaultDateTime);

  const hasDate = Boolean(defaultDateTime);

  function handleCalendarClick() {
    if (hasDate && selectedDateTime) {
      downloadICSFile(item, selectedDateTime);
      return;
    }

    setIsOpen(true);
  }

  function handleAddToCalendar() {
    if (!selectedDateTime) {
      alert("캘린더에 추가할 날짜와 시간을 선택해주세요.");
      return;
    }

    downloadICSFile(item, selectedDateTime);
    setIsOpen(false);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleCalendarClick}
        className="w-full rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100"
      >
        캘린더에 추가
      </button>

      {isOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm font-bold text-slate-700">
            캘린더에 넣을 날짜/시간
          </label>

          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(event) => setSelectedDateTime(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <p className="mt-2 text-xs leading-5 text-slate-500">
            버튼을 누르면 캘린더 일정 파일이 만들어집니다. 다운로드된 파일을 열면
            캘린더 앱에 추가할 수 있습니다.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
            >
              캘린더에 추가
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}