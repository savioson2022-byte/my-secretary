"use client";

import { SCHEDULE_COLORS } from "@/lib/scheduleColors";

type ScheduleColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  label?: string;
};

export default function ScheduleColorPicker({
  value,
  onChange,
  label = "색인",
}: ScheduleColorPickerProps) {
  return (
    <div>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {SCHEDULE_COLORS.map((color) => {
          const isSelected = value === color;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`${color} 색상 선택`}
              className={`h-8 w-8 rounded-full ring-offset-2 transition ${
                isSelected ? "ring-2 ring-slate-900" : "ring-1 ring-slate-200"
              }`}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </div>
  );
}
