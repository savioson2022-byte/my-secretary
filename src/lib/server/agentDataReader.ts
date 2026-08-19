import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantItem } from "@/types/assistant";
import type { SingleSchedule } from "@/types/calendar";
import type { RoutineSchedule } from "@/types/routine";

/**
 * 서버 에이전트 루프가 Supabase에서 사용자 데이터를 읽는다.
 *
 * cloudDataSync가 브라우저에서 올려둔 행을 그대로 읽는다. 즉 로그인하고
 * 동기화가 한 번이라도 돈 사용자만 서버가 볼 수 있다. 저장소 전환(2단계)이
 * 끝나면 이 제약이 사라진다.
 */

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function rowToItem(row: Row): AssistantItem {
  return {
    id: text(row.id),
    originalText: text(row.original_text),
    title: text(row.title),
    category: text(row.category, "기타") as AssistantItem["category"],
    actionType: text(row.action_type, "기타") as AssistantItem["actionType"],
    processType: text(row.process_type, "메모") as AssistantItem["processType"],
    priority: text(row.priority, "보통") as AssistantItem["priority"],
    repeatType: text(row.repeat_type, "일회성") as AssistantItem["repeatType"],
    status: text(row.status, "미완료") as AssistantItem["status"],
    estimatedMinutes: numberOrNull(row.estimated_minutes),
    goalStartDate: nullableText(row.goal_start_date),
    goalTotalAmount: numberOrNull(row.goal_total_amount),
    goalCompletedAmount: numberOrNull(row.goal_completed_amount),
    goalUnit: nullableText(row.goal_unit),
    goalSessionMinutes: numberOrNull(row.goal_session_minutes),
    placePreference:
      row.place_preference === "specific" ? "specific" : "anywhere",
    placeId: nullableText(row.place_id),
    placeName: nullableText(row.place_name),
    placeAddress: nullableText(row.place_address),
    placePostalCode: nullableText(row.place_postal_code),
    dueDate: nullableText(row.due_date),
    reminderDate: nullableText(row.reminder_date),
    scheduleStartTime: nullableText(row.schedule_start_time),
    scheduleEndTime: nullableText(row.schedule_end_time),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  } as AssistantItem;
}

function rowToRoutine(row: Row): RoutineSchedule {
  return {
    id: text(row.id),
    title: text(row.title),
    dayOfWeek: text(row.day_of_week, "월") as RoutineSchedule["dayOfWeek"],
    startTime: text(row.start_time, "00:00"),
    endTime: text(row.end_time, "00:00"),
    placeName: text(row.place_name),
    memo: text(row.memo),
    startDate: nullableText(row.start_date),
    endDate: nullableText(row.end_date),
    isActive: row.is_active !== false,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  } as RoutineSchedule;
}

function rowToSingleSchedule(row: Row): SingleSchedule {
  return {
    id: text(row.id),
    sourceItemId: nullableText(row.source_item_id),
    title: text(row.title),
    date: text(row.date),
    startTime: text(row.start_time, "00:00"),
    endTime: text(row.end_time, "00:00"),
    placeName: text(row.place_name),
    memo: text(row.memo),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  } as SingleSchedule;
}

export type AgentUserData = {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
};

export async function readAgentUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentUserData> {
  const [itemsResult, routinesResult, schedulesResult] = await Promise.all([
    supabase.from("assistant_items").select("*").eq("user_id", userId),
    supabase.from("routine_schedules").select("*").eq("user_id", userId),
    supabase.from("single_schedules").select("*").eq("user_id", userId),
  ]);

  return {
    items: (itemsResult.data ?? []).map(rowToItem),
    routines: (routinesResult.data ?? []).map(rowToRoutine),
    singleSchedules: (schedulesResult.data ?? []).map(rowToSingleSchedule),
  };
}
