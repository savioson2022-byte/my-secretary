import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 외부 브리핑 봇용 읽기 전용 API(GET /api/briefing)의 순수 로직.
 *
 * - DB·Next.js에 의존하지 않아 scripts/test-briefing-api.mjs에서 바로 테스트한다.
 * - 모든 시간은 Asia/Seoul(+09:00, 서머타임 없음) 기준으로 계산한다.
 * - 응답 형식은 하위호환을 유지한다. 깨지는 변경이 필요하면 BRIEFING_API_VERSION을 올린다.
 */

export const BRIEFING_API_VERSION = 1;
export const BRIEFING_TIMEZONE = "Asia/Seoul";
export const MAX_RANGE_DAYS = 14;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOTE_SUMMARY_LENGTH = 200;

const DAY_OF_WEEK_BY_INDEX = ["일", "월", "화", "수", "목", "금", "토"] as const;

const TASK_PROCESS_TYPES = new Set(["즉시처리", "에이전트위임", "시간작업"]);
const NOTE_PROCESS_TYPES = new Set(["메모", "아이디어"]);

type Row = Record<string, unknown>;

export type BriefingEvent = {
  id: string;
  sourceId: string;
  type: "single" | "routine";
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  category: string | null;
  memo: string | null;
  needsPrep: boolean;
};

export type BriefingTaskStatus = "todo" | "doing" | "done" | "on_hold";

export type BriefingTask = {
  id: string;
  title: string;
  due: string | null;
  dueDate: string | null;
  status: BriefingTaskStatus;
  priority: "high" | "normal" | "low" | null;
  category: string | null;
  estimatedMinutes: number | null;
  memo: string | null;
};

export type BriefingNote = {
  id: string;
  title: string;
  date: string;
  summary: string;
  type: "memo" | "idea";
};

export type BriefingRange = { fromMs: number; toMs: number };

export type BriefingResponse = {
  version: number;
  generatedAt: string;
  timezone: string;
  range: { from: string; to: string };
  events: BriefingEvent[];
  tasks: BriefingTask[];
  notes: BriefingNote[];
};

// ─────────────────────────────────────────────
// 인증
// ─────────────────────────────────────────────

/**
 * Authorization: Bearer <토큰> 헤더만 허용한다.
 * 길이 차이로 정보가 새지 않도록 양쪽을 SHA-256으로 맞춘 뒤 상수 시간 비교한다.
 * 기대 토큰이 없으면 항상 거부한다(닫힌 상태로 실패).
 */
export function isBriefingTokenAuthorized(
  authorizationHeader: string | null,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken || expectedToken.trim().length === 0) return false;
  if (!authorizationHeader) return false;

  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader.trim());
  if (!match) return false;

  const given = createHash("sha256").update(match[1], "utf8").digest();
  const expected = createHash("sha256").update(expectedToken, "utf8").digest();

  return timingSafeEqual(given, expected);
}

/** 쿼리스트링으로 토큰을 보내려는 시도를 막는다. */
export function hasTokenInQuery(searchParams: URLSearchParams): boolean {
  return ["token", "access_token", "api_key", "apikey", "key", "authorization"].some(
    (name) => searchParams.has(name)
  );
}

// ─────────────────────────────────────────────
// 시간 유틸 (KST 고정 오프셋)
// ─────────────────────────────────────────────

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** epoch ms → "2026-11-04T07:50:00+09:00" */
export function formatKst(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+09:00`
  );
}

/** epoch ms → KST 날짜 "2026-11-04" */
export function kstDateText(ms: number): string {
  return formatKst(ms).slice(0, 10);
}

/** KST 날짜 + "HH:MM" → epoch ms */
export function kstDateTimeToMs(dateText: string, timeText = "00:00"): number {
  const [y, m, d] = dateText.split("-").map(Number);
  const [hh = 0, mm = 0] = timeText.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - KST_OFFSET_MS;
}

function addDays(dateText: string, days: number): string {
  return kstDateText(kstDateTimeToMs(dateText) + days * DAY_MS);
}

function dayOfWeekOf(dateText: string): string {
  const [y, m, d] = dateText.split("-").map(Number);
  return DAY_OF_WEEK_BY_INDEX[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isDateText(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "15:00:00" / "15:00" → "15:00". 형식이 이상하면 null */
function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh > 24 || mm > 59) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

function minutesOf(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  return hh * 60 + mm;
}

// ─────────────────────────────────────────────
// 범위 파싱
// ─────────────────────────────────────────────

const ISO_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * ISO 8601 날짜시간(시간대 포함) 또는 "YYYY-MM-DD"(KST 자정)를 받는다.
 * 시간대 없는 날짜시간은 해석이 모호하므로 거부한다.
 */
function parseRangeValue(value: string): number | null {
  const trimmed = value.trim();
  if (isDateText(trimmed)) {
    const ms = kstDateTimeToMs(trimmed);
    return kstDateText(ms) === trimmed ? ms : null;
  }
  if (!ISO_WITH_ZONE.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}

export type RangeResult =
  | { ok: true; range: BriefingRange }
  | { ok: false; message: string };

/** 기본값: 오늘 00:00 ~ 내일 24:00 (KST) */
export function resolveRange(
  fromParam: string | null,
  toParam: string | null,
  nowMs: number
): RangeResult {
  const todayStart = kstDateTimeToMs(kstDateText(nowMs));
  let fromMs = todayStart;
  let toMs = todayStart + 2 * DAY_MS;

  if (fromParam !== null) {
    const parsed = parseRangeValue(fromParam);
    if (parsed === null) {
      return { ok: false, message: "from 형식이 올바르지 않습니다. 예: 2026-11-04T00:00:00+09:00" };
    }
    fromMs = parsed;
  }

  if (toParam !== null) {
    const parsed = parseRangeValue(toParam);
    if (parsed === null) {
      return { ok: false, message: "to 형식이 올바르지 않습니다. 예: 2026-11-06T00:00:00+09:00" };
    }
    toMs = parsed;
  } else if (fromParam !== null) {
    // from만 주면 그 시점부터 2일
    toMs = fromMs + 2 * DAY_MS;
  }

  if (toMs <= fromMs) {
    return { ok: false, message: "to는 from보다 뒤여야 합니다." };
  }

  if (toMs - fromMs > MAX_RANGE_DAYS * DAY_MS) {
    return { ok: false, message: `조회 범위는 최대 ${MAX_RANGE_DAYS}일입니다.` };
  }

  return { ok: true, range: { fromMs, toMs } };
}

/** 범위와 겹치는 KST 날짜 목록. 자정을 넘는 일정 때문에 하루 전부터 포함한다. */
function datesCoveringRange(range: BriefingRange): string[] {
  const dates: string[] = [];
  let date = addDays(kstDateText(range.fromMs), -1);
  const last = kstDateText(range.toMs);
  while (date <= last) {
    dates.push(date);
    date = addDays(date, 1);
  }
  return dates;
}

// ─────────────────────────────────────────────
// 값 정리
// ─────────────────────────────────────────────

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** 시작~종료(HH:MM)를 실제 구간으로. 종료가 시작보다 이르면 다음 날 종료(자정 넘김). */
function toInterval(dateText: string, startTime: string, endTime: string) {
  const startMs = kstDateTimeToMs(dateText, startTime);
  let endMs = kstDateTimeToMs(dateText, endTime);
  if (minutesOf(endTime) < minutesOf(startTime)) endMs += DAY_MS;
  return { startMs, endMs };
}

function overlaps(startMs: number, endMs: number, range: BriefingRange) {
  // 길이 0 일정은 시작 시각이 범위 안이면 포함
  if (endMs === startMs) return startMs >= range.fromMs && startMs < range.toMs;
  return startMs < range.toMs && endMs > range.fromMs;
}

// ─────────────────────────────────────────────
// 일정
// ─────────────────────────────────────────────

export function buildEvents(
  singleRows: Row[],
  routineRows: Row[],
  range: BriefingRange
): BriefingEvent[] {
  const events: (BriefingEvent & { startMs: number })[] = [];
  const dates = datesCoveringRange(range);
  const dateSet = new Set(dates);

  for (const row of singleRows) {
    const date = row.date;
    const startTime = normalizeTime(row.start_time);
    const endTime = normalizeTime(row.end_time);
    if (!isDateText(date) || !dateSet.has(date) || !startTime || !endTime) continue;

    const { startMs, endMs } = toInterval(date, startTime, endTime);
    if (!overlaps(startMs, endMs, range)) continue;

    const id = text(row.id);
    events.push({
      id,
      sourceId: id,
      type: "single",
      title: text(row.title),
      start: formatKst(startMs),
      end: formatKst(endMs),
      allDay: false,
      location: nullableText(row.place_name),
      category: null,
      memo: nullableText(row.memo),
      needsPrep: false,
      startMs,
    });
  }

  for (const row of routineRows) {
    if (row.is_active === false) continue;
    const startTime = normalizeTime(row.start_time);
    const endTime = normalizeTime(row.end_time);
    if (!startTime || !endTime) continue;

    const dayOfWeek = text(row.day_of_week);
    const startDate = isDateText(row.start_date) ? row.start_date : null;
    const endDate = isDateText(row.end_date) ? row.end_date : null;
    const cancelled = new Set(textArray(row.cancelled_dates));
    const sourceId = text(row.id);

    for (const date of dates) {
      // 화면(RoutineScheduleManager.isRoutineActiveOnDate)과 같은 규칙
      if (dayOfWeekOf(date) !== dayOfWeek) continue;
      if (startDate && startDate > date) continue;
      if (endDate && endDate < date) continue;
      if (cancelled.has(date)) continue;

      const { startMs, endMs } = toInterval(date, startTime, endTime);
      if (!overlaps(startMs, endMs, range)) continue;

      events.push({
        id: `routine-${sourceId}-${date}`,
        sourceId,
        type: "routine",
        title: text(row.title),
        start: formatKst(startMs),
        end: formatKst(endMs),
        allDay: false,
        location: nullableText(row.place_name),
        category: null,
        memo: nullableText(row.memo),
        needsPrep: false,
        startMs,
      });
    }
  }

  return events
    .sort((a, b) => a.startMs - b.startMs || a.title.localeCompare(b.title))
    .map(({ startMs: _startMs, ...event }) => event);
}

// ─────────────────────────────────────────────
// 할 일 · 기록
// ─────────────────────────────────────────────

const STATUS_MAP: Record<string, BriefingTaskStatus> = {
  미완료: "todo",
  완료: "done",
  보류: "on_hold",
};

const PRIORITY_MAP: Record<string, BriefingTask["priority"]> = {
  높음: "high",
  보통: "normal",
  낮음: "low",
};

function timestampMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 할 일 = process_type이 즉시처리/에이전트위임/시간작업인 기록.
 * - 기본: 완료 제외. 마감 없음, 지난 마감, 범위 안 마감은 포함하고 범위 뒤 마감은 제외.
 * - includeDone=true: 완료된 것 중 범위 안에 마감이거나 범위 안에 수정된 것만 추가.
 */
export function buildTasks(
  itemRows: Row[],
  range: BriefingRange,
  includeDone: boolean
): BriefingTask[] {
  const rangeEndDate = kstDateText(range.toMs - 1);
  const rangeStartDate = kstDateText(range.fromMs);

  const tasks = itemRows
    .filter((row) => TASK_PROCESS_TYPES.has(text(row.process_type)))
    .map((row) => {
      const status = STATUS_MAP[text(row.status)] ?? "todo";
      const dueDate = isDateText(row.due_date) ? row.due_date : null;
      return { row, status, dueDate };
    })
    .filter(({ row, status, dueDate }) => {
      if (status === "done") {
        if (!includeDone) return false;
        const dueInRange = dueDate !== null && dueDate >= rangeStartDate && dueDate <= rangeEndDate;
        const updatedMs = timestampMs(row.updated_at);
        const updatedInRange =
          updatedMs !== null && updatedMs >= range.fromMs && updatedMs < range.toMs;
        return dueInRange || updatedInRange;
      }
      return dueDate === null || dueDate <= rangeEndDate;
    })
    .map(({ row, status, dueDate }) => ({
      id: text(row.id),
      title: text(row.title),
      due: dueDate ? formatKst(kstDateTimeToMs(dueDate)) : null,
      dueDate,
      status,
      priority: PRIORITY_MAP[text(row.priority)] ?? null,
      category: nullableText(row.category),
      estimatedMinutes: numberOrNull(row.estimated_minutes),
      memo: null,
    }));

  const priorityRank = { high: 0, normal: 1, low: 2 } as const;
  return tasks.sort((a, b) => {
    const dueA = a.dueDate ?? "9999-12-31";
    const dueB = b.dueDate ?? "9999-12-31";
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return (priorityRank[a.priority ?? "normal"] ?? 1) - (priorityRank[b.priority ?? "normal"] ?? 1);
  });
}

/** 기록(노트) = 메모/아이디어 중 범위 안에 작성된 것. 최신순. */
export function buildNotes(itemRows: Row[], range: BriefingRange): BriefingNote[] {
  return itemRows
    .filter((row) => NOTE_PROCESS_TYPES.has(text(row.process_type)))
    .map((row) => ({ row, createdMs: timestampMs(row.created_at) }))
    .filter(
      (entry): entry is { row: Row; createdMs: number } =>
        entry.createdMs !== null && entry.createdMs >= range.fromMs && entry.createdMs < range.toMs
    )
    .sort((a, b) => b.createdMs - a.createdMs)
    .map(({ row, createdMs }) => {
      const original = text(row.original_text).replace(/\s+/g, " ").trim();
      return {
        id: text(row.id),
        title: text(row.title),
        date: formatKst(createdMs),
        summary:
          original.length > NOTE_SUMMARY_LENGTH
            ? `${original.slice(0, NOTE_SUMMARY_LENGTH)}…`
            : original,
        type: text(row.process_type) === "아이디어" ? ("idea" as const) : ("memo" as const),
      };
    });
}

/** 같은 id가 여러 auth 사용자에 중복돼 있으면 최신 updated_at 하나만 남긴다. */
export function dedupeById(rows: Row[]): Row[] {
  const byId = new Map<string, Row>();
  for (const row of rows) {
    const id = text(row.id);
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev || text(row.updated_at) > text(prev.updated_at)) byId.set(id, row);
  }
  return Array.from(byId.values());
}

export function buildBriefingResponse(input: {
  nowMs: number;
  range: BriefingRange;
  includeDone: boolean;
  singleRows: Row[];
  routineRows: Row[];
  itemRows: Row[];
}): BriefingResponse {
  const singleRows = dedupeById(input.singleRows);
  const routineRows = dedupeById(input.routineRows);
  const itemRows = dedupeById(input.itemRows);

  return {
    version: BRIEFING_API_VERSION,
    generatedAt: formatKst(input.nowMs),
    timezone: BRIEFING_TIMEZONE,
    range: { from: formatKst(input.range.fromMs), to: formatKst(input.range.toMs) },
    events: buildEvents(singleRows, routineRows, input.range),
    tasks: buildTasks(itemRows, input.range, input.includeDone),
    notes: buildNotes(itemRows, input.range),
  };
}
