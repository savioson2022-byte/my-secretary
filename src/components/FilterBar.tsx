"use client";

import { FilterType } from "@/types/assistant";

const filters: FilterType[] = [
  "전체",
  "미완료",
  "완료",
  "보류",
  "업무",
  "학업",
  "연애 및 친목",
  "건강",
  "자기계발",
  "생활/구매",
  "기타",
];

type FilterBarProps = {
  selectedFilter: FilterType;
  onChange: (filter: FilterType) => void;
};

export default function FilterBar({ selectedFilter, onChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
            selectedFilter === filter
              ? "bg-blue-600 text-white shadow-[0_10px_20px_rgba(49,130,246,0.2)]"
              : "bg-slate-50 text-slate-500 ring-1 ring-slate-100 hover:bg-white"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
