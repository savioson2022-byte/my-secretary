import {
  AssistantTask,
  RoutineSchedule,
  ShortTermSchedule,
  TimePreference,
} from "@/types/assistant-core";

export type TimeBlock = {
  start: string; // "17:30"
  end: string; // "18:20"
  availableMinutes: number;
  label?: string;
};

export type ScheduleSuggestion = {
  taskId: string;
  taskTitle: string;
  suggestedDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  warning?: string;
};

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getPreferenceRange(preference: TimePreference) {
  switch (preference) {
    case "아침":
      return { start: "06:00", end: "09:00" };
    case "오전":
      return { start: "09:00", end: "12:00" };
    case "점심":
      return { start: "12:00", end: "14:00" };
    case "오후":
      return { start: "14:00", end: "18:00" };
    case "저녁":
      return { start: "18:00", end: "21:00" };
    case "밤":
      return { start: "21:00", end: "24:00" };
    default:
      return null;
  }
}

function isBadEnergyMatch(task: AssistantTask, block: TimeBlock) {
  const startMinutes = timeToMinutes(block.start);
  const endMinutes = timeToMinutes(block.end);

  const isLunchTime = startMinutes < timeToMinutes("14:00") && endMinutes > timeToMinutes("12:00");

  if (task.actionType === "운동" && isLunchTime && task.environment.needsShowerAfter) {
    return "운동 후 샤워하기 어려운 시간대라 추천하지 않습니다.";
  }

  if (task.energyRequired === "높음" && startMinutes >= timeToMinutes("23:00")) {
    return "에너지가 많이 필요한 작업인데 너무 늦은 시간입니다.";
  }

  return null;
}

function matchesPreferredTime(task: AssistantTask, block: TimeBlock) {
  if (task.preferredTime === "상관없음") return true;

  const range = getPreferenceRange(task.preferredTime);
  if (!range) return true;

  const blockStart = timeToMinutes(block.start);
  const rangeStart = timeToMinutes(range.start);
  const rangeEnd = timeToMinutes(range.end);

  return blockStart >= rangeStart && blockStart < rangeEnd;
}

export function suggestTaskSchedule({
  task,
  date,
  availableBlocks,
}: {
  task: AssistantTask;
  date: string;
  availableBlocks: TimeBlock[];
}): ScheduleSuggestion | null {
  if (task.mainType !== "시간작업") return null;
  if (!task.estimatedMinutes) return null;

  const sortedBlocks = [...availableBlocks].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const preferredBlocks = sortedBlocks.filter((block) =>
    matchesPreferredTime(task, block)
  );

  const candidateBlocks = preferredBlocks.length > 0 ? preferredBlocks : sortedBlocks;

  for (const block of candidateBlocks) {
    if (block.availableMinutes < task.estimatedMinutes) continue;

    const warning = isBadEnergyMatch(task, block);
    if (warning) continue;

    const startMinutes = timeToMinutes(block.start);
    const endMinutes = startMinutes + task.estimatedMinutes;

    return {
      taskId: task.id,
      taskTitle: task.title,
      suggestedDate: date,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      reason: "정기 시간표와 단기 일정을 제외한 빈 시간 중 작업 조건에 맞는 시간입니다.",
    };
  }

  return null;
}

// 아직은 뼈대용 함수.
// 다음 단계에서 정기 시간표, 단기 일정, 이동 시간을 반영해서 실제 빈 시간을 계산하게 만들면 됨.
export function calculateAvailableBlocksForDate({
  routines,
  shortTermSchedules,
}: {
  routines: RoutineSchedule[];
  shortTermSchedules: ShortTermSchedule[];
}): TimeBlock[] {
  console.log(routines, shortTermSchedules);

  return [
    {
      start: "17:30",
      end: "18:10",
      availableMinutes: 40,
      label: "방과 후 짧은 빈 시간",
    },
    {
      start: "22:30",
      end: "23:30",
      availableMinutes: 60,
      label: "밤 공부 가능 시간",
    },
  ];
}