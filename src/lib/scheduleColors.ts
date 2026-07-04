export const SCHEDULE_COLORS = [
  "#3182F6",
  "#22C55E",
  "#A78BFA",
  "#F97316",
  "#EF4444",
  "#14B8A6",
  "#111827",
];

export const DEFAULT_SINGLE_SCHEDULE_COLOR = "#3182F6";
export const DEFAULT_ROUTINE_SCHEDULE_COLOR = "#22C55E";

export function getScheduleColor(
  color: string | null | undefined,
  fallback = DEFAULT_SINGLE_SCHEDULE_COLOR
) {
  return color?.trim() || fallback;
}

export function getSoftColorStyle(color: string) {
  return {
    backgroundColor: `${color}18`,
    borderColor: `${color}42`,
    color,
  };
}
