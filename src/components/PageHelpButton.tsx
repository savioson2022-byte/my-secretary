"use client";

import { useEffect, useState } from "react";
import { PAGE_HELP_CONTENT, type HelpTopic } from "@/lib/pageHelpContent";

export default function PageHelpButton({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(false);
  const content = PAGE_HELP_CONTENT[topic];

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${content.title} 도움말 열기`} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-lg font-black text-blue-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-blue-50 active:scale-95">?</button>
    {open && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} role="dialog" aria-modal="true" aria-labelledby={`help-${topic}`}>
      <section className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-6 shadow-2xl sm:rounded-[30px]">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black text-blue-600">페이지 설명서</p><h2 id={`help-${topic}`} className="mt-1 text-2xl font-black text-slate-950">{content.title}</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="도움말 닫기" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600">×</button>
        </div>
        <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-950">{content.summary}</p>
        <div className="mt-5 space-y-5">{content.sections.map((section) => <div key={section.title}><h3 className="font-black text-slate-900">{section.title}</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{section.body}</p></div>)}</div>
        <button type="button" onClick={() => setOpen(false)} className="mt-6 min-h-12 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">확인했어요</button>
      </section>
    </div>}
  </>;
}
