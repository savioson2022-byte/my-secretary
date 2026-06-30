"use client";

type InputBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onClassify: () => void;
};

export default function InputBox({ value, onChange, onClassify }: InputBoxProps) {
  return (
    <section className="app-card p-4">
      <label className="text-sm font-black text-slate-700">
        떠오른 생각을 입력해보세요
      </label>

      <div className="mt-3 flex items-end gap-3 rounded-[22px] bg-slate-50 p-3 ring-1 ring-slate-100">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: 내일 3시 치과 예약"
          className="min-h-20 flex-1 resize-none bg-transparent px-1 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={onClassify}
          aria-label="분류하기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-[0_12px_24px_rgba(49,130,246,0.28)] transition hover:bg-blue-500"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v10" />
            <path d="M8 7h8" />
            <path d="M5 13a7 7 0 0 0 14 0" />
            <path d="M12 20v1" />
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-xs font-black text-slate-500">
        {["할 일", "일정", "아이디어", "기타"].map((label) => (
          <span key={label} className="rounded-2xl bg-slate-100 px-2 py-2 text-center">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
