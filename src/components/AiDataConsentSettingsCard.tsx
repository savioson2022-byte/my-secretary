"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AI_DATA_CONSENT_CHANGED_EVENT,
  getAiDataConsentChoice,
  saveAiDataConsent,
  type AiDataConsentChoice,
} from "@/lib/aiDataConsent";

export default function AiDataConsentSettingsCard() {
  const [choice, setChoice] = useState<AiDataConsentChoice>(null);
  useEffect(() => {
    const refresh = () => setChoice(getAiDataConsentChoice());
    refresh();
    window.addEventListener(AI_DATA_CONSENT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AI_DATA_CONSENT_CHANGED_EVENT, refresh);
  }, []);

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">외부 AI 데이터 전송</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            일정·작업·메모와 주문 관련 메일 내용을 OpenAI로 보내 분류·정리합니다.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${choice === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {choice === "accepted" ? "동의함" : "사용 안 함"}
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
        거부하거나 철회하면 외부 전송은 중단되며 규칙 기반 분류와 기기 내 Gemma는 계속 사용할 수 있습니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void saveAiDataConsent(choice === "accepted" ? "declined" : "accepted")} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">
          {choice === "accepted" ? "동의 철회" : "내용 확인 후 동의"}
        </button>
        <Link href="/privacy" className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700">개인정보처리방침</Link>
      </div>
    </section>
  );
}
