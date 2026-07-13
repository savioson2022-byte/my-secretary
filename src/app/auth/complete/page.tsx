"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("로그인을 확인하고 있습니다.");

  useEffect(() => {
    async function completeLogin() {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setMessage("Supabase 설정이 아직 연결되지 않았습니다.");
        return;
      }

      const code = searchParams.get("code");
      const error = searchParams.get("error_description") ?? searchParams.get("error");
      const nextPath = getSafeNextPath(searchParams.get("next"));

      if (error) {
        setMessage(error);
        return;
      }

      if (!code) {
        const { data } = await supabase.auth.getSession();

        if (data.session) {
          router.replace(nextPath);
          return;
        }

        setMessage("로그인 확인 코드가 없습니다. 다시 로그인해주세요.");
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setMessage(exchangeError.message);
        return;
      }

      router.replace(nextPath);
    }

    completeLogin();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white shadow-lg shadow-blue-200">
          나
        </div>
        <h1 className="text-2xl font-black">로그인 연결 중</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
      </section>
    </main>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
          <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white shadow-lg shadow-blue-200">
              나
            </div>
            <h1 className="text-2xl font-black">로그인 연결 중</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              로그인 정보를 불러오고 있습니다.
            </p>
          </section>
        </main>
      }
    >
      <AuthCompleteContent />
    </Suspense>
  );
}
