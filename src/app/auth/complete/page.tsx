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

function createNativeSessionUrl({
  accessToken,
  refreshToken,
  nextPath,
}: {
  accessToken: string;
  refreshToken: string;
  nextPath: string;
}) {
  const nativeUrl = new URL("mysecretary://auth/session");
  const hashParams = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    next: nextPath,
  });

  nativeUrl.hash = hashParams.toString();

  return nativeUrl.toString();
}

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("로그인을 확인하고 있습니다.");
  const [webContinuePath, setWebContinuePath] = useState("/account");
  const [nativeSessionUrl, setNativeSessionUrl] = useState<string | null>(null);

  useEffect(() => {
    async function completeLogin() {
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setMessage("Supabase 설정이 아직 연결되지 않았습니다.");
        return;
      }

      const code = searchParams.get("code");
      const error = searchParams.get("error_description") ?? searchParams.get("error");
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const hashError =
        hashParams.get("error_description") ?? hashParams.get("error");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");
      const defaultNextPath =
        hashType === "recovery" ? "/account?reset_password=1" : "/account";
      const nextPath = getSafeNextPath(
        searchParams.get("next") ?? hashParams.get("next") ?? defaultNextPath
      );
      setWebContinuePath(nextPath);

      if (error || hashError) {
        setMessage(error ?? hashError ?? "로그인 링크 처리 중 오류가 생겼습니다.");
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setMessage(sessionError.message);
          return;
        }

        const nativeUrl = createNativeSessionUrl({
          accessToken,
          refreshToken,
          nextPath,
        });

        setNativeSessionUrl(nativeUrl);
        setMessage(
          hashType === "recovery"
            ? "비밀번호 재설정 로그인이 확인됐습니다. 앱으로 돌아가 새 비밀번호를 저장하세요."
            : "로그인이 확인됐습니다. 앱으로 돌아가거나 웹에서 계속할 수 있습니다."
        );

        const timer = window.setTimeout(() => {
          window.location.href = nativeUrl;
        }, 700);

        return () => window.clearTimeout(timer);
      }

      if (!code) {
        const { data } = await supabase.auth.getSession();

        if (data.session) {
          setNativeSessionUrl(
            createNativeSessionUrl({
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              nextPath,
            })
          );
          setMessage("로그인이 확인됐습니다. 앱으로 돌아가거나 웹에서 계속할 수 있습니다.");
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

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setMessage("로그인은 확인됐지만 세션을 저장하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const nativeUrl = createNativeSessionUrl({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        nextPath,
      });

      setNativeSessionUrl(nativeUrl);
      setMessage("로그인이 확인됐습니다. 앱으로 돌아가거나 웹에서 계속할 수 있습니다.");

      const timer = window.setTimeout(() => {
        window.location.href = nativeUrl;
      }, 700);

      return () => window.clearTimeout(timer);
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
        {nativeSessionUrl && (
          <div className="mt-6 grid w-full gap-3">
            <a
              href={nativeSessionUrl}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-100"
            >
              나의 비서 앱으로 돌아가기
            </a>
            <button
              type="button"
              onClick={() => router.replace(webContinuePath)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-600 ring-1 ring-slate-200"
            >
              웹에서 계속하기
            </button>
            <p className="text-xs font-semibold leading-5 text-slate-400">
              앱이 자동으로 열리지 않으면 위 버튼을 한 번 눌러주세요.
            </p>
          </div>
        )}
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
