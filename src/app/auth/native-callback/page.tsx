"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export default function NativeAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("로그인을 확인하고 있습니다.");

  useEffect(() => {
    async function completeNativeLogin() {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setMessage("Supabase 설정이 아직 연결되지 않았습니다.");
        return;
      }

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const nextPath = getSafeNextPath(hashParams.get("next"));

      if (!accessToken || !refreshToken) {
        setMessage("앱 로그인 토큰을 찾지 못했습니다. 다시 로그인해주세요.");
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace(nextPath);
    }

    completeNativeLogin();
  }, [router]);

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
