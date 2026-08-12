"use client";

import { useEffect, useState } from "react";
import { AI_DATA_CONSENT_CHANGED_EVENT, getAiDataConsentChoice } from "@/lib/aiDataConsent";
import { FIRST_SIGNUP_GUIDE_SEEN_KEY, shouldShowFirstSignupGuide } from "@/lib/firstSignupGuide";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function FirstSignupTimeTaskGuide() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!cancelled && user && getAiDataConsentChoice(user.id) !== null && shouldShowFirstSignupGuide(user) && !localStorage.getItem(`my-secretary:${user.id}:${FIRST_SIGNUP_GUIDE_SEEN_KEY}`)) {
        setUserId(user.id);
        window.setTimeout(() => !cancelled && setOpen(true), 500);
      }
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void check();
      if (event === "SIGNED_OUT") setOpen(false);
    });
    const recheckAfterConsent = () => void check();
    window.addEventListener(AI_DATA_CONSENT_CHANGED_EVENT, recheckAfterConsent);
    return () => { cancelled = true; listener.subscription.unsubscribe(); window.removeEventListener(AI_DATA_CONSENT_CHANGED_EVENT, recheckAfterConsent); };
  }, []);

  async function close() {
    setOpen(false);
    if (!userId) return;
    localStorage.setItem(`my-secretary:${userId}:${FIRST_SIGNUP_GUIDE_SEEN_KEY}`, new Date().toISOString());
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.updateUser({ data: { [FIRST_SIGNUP_GUIDE_SEEN_KEY]: new Date().toISOString(), time_task_guide_pending: false } });
  }

  if (!open) return null;
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="first-time-task-guide">
    <section className="w-full max-w-lg rounded-[30px] bg-white p-6 shadow-2xl">
      <p className="text-sm font-black text-blue-600">처음 오셨군요!</p>
      <h2 id="first-time-task-guide" className="mt-2 text-2xl font-black text-slate-950">나의 비서의 핵심, 시간 작업</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">마감까지 해야 할 일을 말하면 비서가 남은 빈 시간을 찾아 실행 가능한 여러 회차로 나눠드립니다.</p>
      <ol className="mt-5 space-y-3 text-sm font-bold text-slate-700">
        <li className="rounded-2xl bg-slate-50 p-4"><b className="text-blue-600">1.</b> “앞으로 3일 동안 책 300쪽 읽기”처럼 말하거나 입력해요.</li>
        <li className="rounded-2xl bg-slate-50 p-4"><b className="text-blue-600">2.</b> AI가 만든 분류, 분량, 시간과 장소를 확인하고 고쳐요.</li>
        <li className="rounded-2xl bg-slate-50 p-4"><b className="text-blue-600">3.</b> 승인하면 빈 시간에 나뉘어 저장되고 주간 캘린더에서 확인할 수 있어요.</li>
      </ol>
      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">이 안내는 처음 가입한 계정에 한 번만 표시됩니다. 홈 화면의 ? 버튼에서 언제든 다시 볼 수 있어요.</p>
      <button type="button" onClick={() => void close()} className="mt-5 min-h-12 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">시간 작업 시작하기</button>
    </section>
  </div>;
}
