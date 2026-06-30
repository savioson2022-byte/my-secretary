"use client";

import { updateSingleSchedule } from "@/lib/singleScheduleStorage";
import { SingleSchedule } from "@/types/calendar";
import { useState } from "react";

type SingleScheduleListProps = {
  schedules: SingleSchedule[];
  onDelete: (id: string) => void;
};

function sortSchedulesByDateTime(schedules: SingleSchedule[]) {
  return [...schedules].sort((a, b) => {
    const aValue = `${a.date} ${a.startTime}`;
    const bValue = `${b.date} ${b.startTime}`;

    return aValue.localeCompare(bValue);
  });
}

export default function SingleScheduleList({
  schedules,
  onDelete,
}: SingleScheduleListProps) {
  const sortedSchedules = sortSchedulesByDateTime(schedules);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editPlaceName, setEditPlaceName] = useState("");
  const [editMemo, setEditMemo] = useState("");

  function startEdit(schedule: SingleSchedule) {
    setEditingId(schedule.id);
    setEditTitle(schedule.title);
    setEditDate(schedule.date);
    setEditStartTime(schedule.startTime);
    setEditEndTime(schedule.endTime);
    setEditPlaceName(schedule.placeName);
    setEditMemo(schedule.memo);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDate("");
    setEditStartTime("");
    setEditEndTime("");
    setEditPlaceName("");
    setEditMemo("");
  }

  function saveEdit(schedule: SingleSchedule) {
    if (!editTitle.trim()) {
      alert("일정 제목을 입력해줘.");
      return;
    }

    if (!editDate) {
      alert("날짜를 입력해줘.");
      return;
    }

    if (!editStartTime || !editEndTime) {
      alert("시작 시간과 종료 시간을 입력해줘.");
      return;
    }

    if (editStartTime >= editEndTime) {
      alert("종료 시간은 시작 시간보다 늦어야 해.");
      return;
    }

    updateSingleSchedule({
      ...schedule,
      title: editTitle.trim(),
      date: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      placeName: editPlaceName.trim(),
      memo: editMemo.trim(),
      updatedAt: new Date().toISOString(),
    });

    cancelEdit();
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
      <div>
        <h3 className="text-base font-black text-slate-900">단기 일정</h3>
        <p className="mt-1 text-sm text-slate-500">
          한 번만 발생하는 병원, 약속, 시험, 보강 같은 일정이 여기에 표시됩니다.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {sortedSchedules.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">
            아직 등록된 단기 일정이 없습니다.
          </p>
        ) : (
          sortedSchedules.map((schedule) => {
            const isEditing = editingId === schedule.id;

            return (
              <article
                key={schedule.id}
                className="rounded-2xl border border-slate-100 bg-white p-4"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        일정 제목
                      </label>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          날짜
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          시작
                        </label>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(event) =>
                            setEditStartTime(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          종료
                        </label>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(event) =>
                            setEditEndTime(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        위치
                      </label>
                      <input
                        value={editPlaceName}
                        onChange={(event) =>
                          setEditPlaceName(event.target.value)
                        }
                        placeholder="예: 병원, 학교, 카페, 학원"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        메모
                      </label>
                      <input
                        value={editMemo}
                        onChange={(event) => setEditMemo(event.target.value)}
                        placeholder="예: 준비물, 약속 내용, 참고사항"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(schedule)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        저장
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">
                        {schedule.title}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {schedule.date} {schedule.startTime} ~{" "}
                        {schedule.endTime}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        위치: {schedule.placeName || "아직 입력 안 됨"}
                      </p>

                      {schedule.memo && (
                        <p className="mt-1 text-sm text-slate-500">
                          메모: {schedule.memo}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(schedule)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(schedule.id)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}