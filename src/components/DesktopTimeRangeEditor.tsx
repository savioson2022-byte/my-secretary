"use client";

const DAY_MINUTES = 24 * 60;
const STEP_MINUTES = 10;

function timeToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(value: number) {
  const safeValue = Math.max(0, Math.min(DAY_MINUTES, value));
  const hour = Math.floor(safeValue / 60);
  const minute = safeValue % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatKoreanTime(value: string) {
  const minutes = timeToMinutes(value);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

export default function DesktopTimeRangeEditor({
  startTime,
  endTime,
  onChange,
}: {
  startTime: string;
  endTime: string;
  onChange: (value: { startTime: string; endTime: string }) => void;
}) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const left = (startMinutes / DAY_MINUTES) * 100;
  const width = ((endMinutes - startMinutes) / DAY_MINUTES) * 100;

  function changeStart(nextValue: number) {
    const duration = Math.max(STEP_MINUTES, endMinutes - startMinutes);
    const nextStart = Math.min(nextValue, DAY_MINUTES - duration);
    onChange({
      startTime: minutesToTime(nextStart),
      endTime: minutesToTime(nextStart + duration),
    });
  }

  function changeEnd(nextValue: number) {
    const nextEnd = Math.max(nextValue, startMinutes + STEP_MINUTES);
    onChange({ startTime, endTime: minutesToTime(nextEnd) });
  }

  return (
    <div className="hidden rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100 lg:block">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black text-slate-500">24시간 빠른 조절</p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {formatKoreanTime(startTime)} - {formatKoreanTime(endTime)}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-600 ring-1 ring-blue-100">
          {Math.max(0, endMinutes - startMinutes)}분
        </span>
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-slate-200">
        <div
          className="absolute inset-y-0 rounded-full bg-blue-500"
          style={{ left: `${left}%`, width: `${Math.max(width, 0.7)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
        <span>오전 0시</span>
        <span>오전 6시</span>
        <span>오후 12시</span>
        <span>오후 6시</span>
        <span>밤 12시</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-5">
        <label className="text-xs font-black text-slate-500">
          시작 시간 드래그
          <input
            type="range"
            min={0}
            max={DAY_MINUTES - STEP_MINUTES}
            step={STEP_MINUTES}
            value={startMinutes}
            onChange={(event) => changeStart(Number(event.target.value))}
            className="mt-2 w-full accent-blue-600"
          />
        </label>
        <label className="text-xs font-black text-slate-500">
          종료 시간 드래그
          <input
            type="range"
            min={STEP_MINUTES}
            max={DAY_MINUTES}
            step={STEP_MINUTES}
            value={endMinutes}
            onChange={(event) => changeEnd(Number(event.target.value))}
            className="mt-2 w-full accent-blue-600"
          />
        </label>
      </div>
    </div>
  );
}
