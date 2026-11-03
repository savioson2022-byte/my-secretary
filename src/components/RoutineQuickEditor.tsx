"use client";

import { useState } from "react";
import type { DayOfWeek, RoutineSchedule } from "@/types/routine";

const DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

type Timing = Pick<RoutineSchedule, "dayOfWeek" | "startTime" | "endTime">;

export default function RoutineQuickEditor({ routine, onSave }: {
  routine: RoutineSchedule;
  onSave: (timing: Timing) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [timing, setTiming] = useState<Timing>(routine);
  const [message, setMessage] = useState("");
  const fieldClass = "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm";

  return (
    <div className="rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-900">{routine.dayOfWeek}요일 · {routine.startTime} ~ {routine.endTime}</p>
        {!editing && <button type="button" className="rounded-xl bg-emerald-50 px-3 py-3 font-bold text-emerald-800" onClick={() => {
          setTiming(routine); setMessage(""); setEditing(true);
        }}>요일·시간 변경</button>}
      </div>
      {editing && <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-slate-500">이 수업의 매주 반복 요일·시간을 변경합니다. 같은 제목의 다른 수업은 그대로 유지됩니다. 기존 반복 기간 전체에 적용되며, 하루만 이동하는 기능은 아닙니다.</p>
        <label className="block font-bold">옮길 요일
          <select aria-label={`${routine.title} ${routine.dayOfWeek}요일 수업의 옮길 요일`} className={`${fieldClass} mt-1`} value={timing.dayOfWeek} onChange={event => setTiming({ ...timing, dayOfWeek: event.target.value as DayOfWeek })}>
            {DAYS.map(day => <option key={day} value={day}>{day}요일</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 font-bold">시작<input aria-label="변경할 시작 시간" className={`${fieldClass} mt-1`} type="time" value={timing.startTime} onChange={event => setTiming({ ...timing, startTime: event.target.value })} /></label>
          <label className="min-w-0 font-bold">종료<input aria-label="변경할 종료 시간" className={`${fieldClass} mt-1`} type="time" value={timing.endTime} onChange={event => setTiming({ ...timing, endTime: event.target.value })} /></label>
        </div>
        <p className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">{routine.dayOfWeek} {routine.startTime}~{routine.endTime} → {timing.dayOfWeek} {timing.startTime}~{timing.endTime}</p>
        <p className="text-xs text-slate-500">장소·메모·반복 기간은 유지됩니다. 특정 날짜 취소 기록은 원래 날짜에 남습니다.</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white" onClick={() => {
            try { onSave(timing); setEditing(false); setMessage("변경을 저장했습니다."); }
            catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다. 다시 시도해 주세요."); }
          }}>이 수업만 저장</button>
          <button type="button" className="rounded-xl bg-slate-100 px-4 py-3 font-bold" onClick={() => { setEditing(false); setMessage(""); }}>취소</button>
        </div>
      </div>}
      {message && <p role="status" className="mt-2 text-sm font-bold text-slate-700">{message}</p>}
    </div>
  );
}
