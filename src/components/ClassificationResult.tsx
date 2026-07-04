"use client";

import {
  ActionType,
  AssistantItemWithoutId,
  Category,
  Priority,
  ProcessType,
  RepeatType,
} from "@/types/assistant";
import ScheduleColorPicker from "@/components/ScheduleColorPicker";
import { DEFAULT_SINGLE_SCHEDULE_COLOR } from "@/lib/scheduleColors";

type ClassificationResultProps = {
  result: AssistantItemWithoutId;
  onChange: (nextResult: AssistantItemWithoutId) => void;
  onSave: () => void;
};

const CATEGORY_OPTIONS: Category[] = [
  "업무",
  "학업",
  "연애 및 친목",
  "건강",
  "자기계발",
  "생활/구매",
  "기타",
];

const ACTION_TYPE_OPTIONS: ActionType[] = [
  "구매",
  "검색/조사",
  "연락",
  "예약",
  "공부",
  "운동",
  "정리",
  "아이디어",
  "메모",
  "기타",
];

const PROCESS_TYPE_OPTIONS: ProcessType[] = [
  "즉시처리",
  "시간작업",
  "단기일정",
  "정기시간표",
  "메모",
  "아이디어",
];

const PRIORITY_OPTIONS: Priority[] = ["낮음", "보통", "높음"];

const REPEAT_TYPE_OPTIONS: RepeatType[] = ["일회성", "주기성"];

function getProcessDescription(processType: ProcessType) {
  if (processType === "즉시처리") {
    return "5분 안에 끝낼 수 있는 일입니다. 빠르게 처리할 수 있습니다.";
  }

  if (processType === "시간작업") {
    return "시간을 잡고 해야 하는 작업입니다. 캘린더의 빈 시간에 배치 추천됩니다.";
  }

  if (processType === "단기일정") {
    return "한 번만 있는 확정 일정입니다. 날짜와 시간이 있으면 캘린더에 자동 등록됩니다.";
  }

  if (processType === "정기시간표") {
    return "반복되는 고정 일정입니다. 정기 일정으로 따로 입력하는 것이 좋습니다.";
  }

  if (processType === "메모") {
    return "행동보다는 기억해둘 정보입니다.";
  }

  if (processType === "아이디어") {
    return "나중에 발전시킬 수 있는 생각입니다.";
  }

  return "분류 설명이 없습니다.";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-black text-slate-500">{children}</label>;
}

function timeToMinutes(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function createDefaultEndTime(
  startTime: string,
  estimatedMinutes: number | null
) {
  const startMinutes = timeToMinutes(startTime);
  const duration = estimatedMinutes ?? 60;

  return minutesToTime(startMinutes + duration);
}

export default function ClassificationResult({
  result,
  onChange,
  onSave,
}: ClassificationResultProps) {
  function updateResult(nextPartialResult: Partial<AssistantItemWithoutId>) {
    onChange({
      ...result,
      ...nextPartialResult,
    });
  }

  function handleEstimatedMinutesChange(value: string) {
    if (!value.trim()) {
      updateResult({
        estimatedMinutes: null,
      });
      return;
    }

    const minutes = Number(value);

    if (Number.isNaN(minutes)) {
      return;
    }

    updateResult({
      estimatedMinutes: minutes,
    });
  }

  function handleScheduleStartTimeChange(value: string) {
    if (!value) {
      updateResult({
        scheduleStartTime: null,
      });
      return;
    }

    updateResult({
      scheduleStartTime: value,
      scheduleEndTime:
        result.scheduleEndTime ??
        createDefaultEndTime(value, result.estimatedMinutes),
    });
  }

  return (
    <section className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">분류 결과</h2>
          <p className="mt-1 text-sm text-slate-500">
            저장하기 전에 분류가 맞는지 확인하고 직접 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] bg-blue-50 p-4 ring-1 ring-blue-100">
        <p className="text-sm font-bold text-blue-700">현재 처리 방식</p>
        <p className="mt-1 text-2xl font-black text-blue-950">
          {result.processType}
        </p>
        <p className="mt-2 text-sm leading-6 text-blue-800">
          {getProcessDescription(result.processType)}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <FieldLabel>제목</FieldLabel>
          <input
            value={result.title}
            onChange={(event) =>
              updateResult({
                title: event.target.value,
              })
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>분야</FieldLabel>
            <select
              value={result.category}
              onChange={(event) =>
                updateResult({
                  category: event.target.value as Category,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>행동 유형</FieldLabel>
            <select
              value={result.actionType}
              onChange={(event) =>
                updateResult({
                  actionType: event.target.value as ActionType,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {ACTION_TYPE_OPTIONS.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>처리 방식</FieldLabel>
          <select
            value={result.processType}
            onChange={(event) =>
              updateResult({
                processType: event.target.value as ProcessType,
              })
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
          >
            {PROCESS_TYPE_OPTIONS.map((processType) => (
              <option key={processType} value={processType}>
                {processType}
              </option>
            ))}
          </select>
        </div>

        {result.processType === "단기일정" && (
          <ScheduleColorPicker
            label="캘린더 색인"
            value={result.color ?? DEFAULT_SINGLE_SCHEDULE_COLOR}
            onChange={(color) => updateResult({ color })}
          />
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>예상 시간</FieldLabel>
            <input
              type="number"
              min={0}
              value={result.estimatedMinutes ?? ""}
              onChange={(event) =>
                handleEstimatedMinutesChange(event.target.value)
              }
              placeholder="예: 60"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <p className="mt-1 text-xs font-semibold text-slate-400">분 단위</p>
          </div>

          <div>
            <FieldLabel>중요도</FieldLabel>
            <select
              value={result.priority}
              onChange={(event) =>
                updateResult({
                  priority: event.target.value as Priority,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>반복성</FieldLabel>
            <select
              value={result.repeatType}
              onChange={(event) =>
                updateResult({
                  repeatType: event.target.value as RepeatType,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {REPEAT_TYPE_OPTIONS.map((repeatType) => (
                <option key={repeatType} value={repeatType}>
                  {repeatType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>마감일 / 일정 날짜</FieldLabel>
            <input
              type="date"
              value={result.dueDate ?? ""}
              onChange={(event) =>
                updateResult({
                  dueDate: event.target.value || null,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <FieldLabel>알림일</FieldLabel>
            <input
              type="date"
              value={result.reminderDate ?? ""}
              onChange={(event) =>
                updateResult({
                  reminderDate: event.target.value || null,
                })
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {result.processType === "단기일정" && (
          <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
            <p className="text-sm font-black text-sky-900">단기일정 시간</p>
            <p className="mt-1 text-sm leading-6 text-sky-800">
              AI가 일정 시간을 추출합니다. 틀렸거나 비어 있으면 직접 수정할 수
              있습니다.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>시작 시간</FieldLabel>
                <input
                  type="time"
                  value={result.scheduleStartTime ?? ""}
                  onChange={(event) =>
                    handleScheduleStartTimeChange(event.target.value)
                  }
            className="mt-2 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <FieldLabel>종료 시간</FieldLabel>
                <input
                  type="time"
                  value={result.scheduleEndTime ?? ""}
                  onChange={(event) =>
                    updateResult({
                      scheduleEndTime: event.target.value || null,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {!result.dueDate && (
              <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
                일정 날짜가 없어서 저장해도 캘린더에는 자동 등록되지 않습니다.
              </p>
            )}

            {!result.scheduleStartTime && (
              <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
                시작 시간이 없어서 저장해도 캘린더에는 자동 등록되지 않습니다.
              </p>
            )}
          </div>
        )}

        {result.processType === "시간작업" && (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
            <p className="font-black">시간작업 추천 안내</p>
            <p className="mt-1">
              시간작업은 저장 후 캘린더의 빈 시간에 배치 추천됩니다. 추천을
              받으려면 예상 시간을 입력해두는 것이 좋습니다.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(49,130,246,0.22)] transition hover:bg-blue-500"
      >
        수정한 내용으로 저장하기
      </button>
    </section>
  );
}
