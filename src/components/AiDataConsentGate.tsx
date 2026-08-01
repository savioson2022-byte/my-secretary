"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AI_DATA_CONSENT_CHANGED_EVENT,
  getAiDataConsentChoice,
  saveAiDataConsent,
  type AiDataConsentChoice,
} from "@/lib/aiDataConsent";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AiDataConsentGate() {
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [choice, setChoice] = useState<AiDataConsentChoice>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function decide(nextChoice: "accepted" | "declined") {
    setIsSaving(true);
    setError("");
    try {
      await saveAiDataConsent(nextChoice);
    } catch {
      setError("선택을 저장하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let activeUserId: string | null = null;
    const refresh = () => setChoice(getAiDataConsentChoice(activeUserId ?? undefined));
    refresh();
    void supabase?.auth.getSession().then(({ data }) => {
      activeUserId = data.session?.user.id ?? null;
      setUserId(activeUserId);
      setSignedIn(Boolean(data.session));
      refresh();
    });
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      activeUserId = session?.user.id ?? null;
      setUserId(activeUserId);
      setSignedIn(Boolean(session));
      refresh();
    }) ?? { data: { subscription: null } };
    window.addEventListener(AI_DATA_CONSENT_CHANGED_EVENT, refresh);
    return () => {
      listener.subscription?.unsubscribe();
      window.removeEventListener(AI_DATA_CONSENT_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!signedIn || !userId || choice !== null) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-sm font-black text-blue-600">선택 후 사용</p>
        <h2 id="ai-consent-title" className="mt-2 text-2xl font-black text-slate-950">외부 AI로 내용 보내기</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          동의하면 입력한 일정·작업·메모와 개인화 기준, 연결한 구매 메일의 주문 관련 내용이 분류·정리를 위해 OpenAI로 전송됩니다. OpenAI는 나의 비서와 별개의 제3자 서비스입니다.
        </p>
        <ul className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          <li>• 목적: 입력 분류, 아이디어 묶기, 구매 정보 추출</li>
          <li>• 보내지 않는 정보: 비밀번호, 인증 토큰, 전체 메일함</li>
          <li>• 거부해도 규칙 기반 기능과 기기 내 Gemma는 사용할 수 있음</li>
          <li>• 설정에서 언제든 동의를 철회할 수 있음</li>
        </ul>
        <Link href="/privacy" className="mt-4 inline-block text-sm font-black text-blue-600">개인정보처리방침 자세히 보기</Link>
        {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" disabled={isSaving} onClick={() => void decide("declined")} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50">동의하지 않음</button>
          <button type="button" disabled={isSaving} onClick={() => void decide("accepted")} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{isSaving ? "저장 중..." : "동의하고 사용"}</button>
        </div>
      </section>
    </div>
  );
}
