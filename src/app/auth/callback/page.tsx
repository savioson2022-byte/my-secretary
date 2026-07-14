"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function AuthCallbackContent() {
  const router = useRouter();

  useEffect(() => {
    const target = `/auth/complete${window.location.search}${window.location.hash}`;

    router.replace(target);
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white shadow-lg shadow-blue-200">
          나
        </div>
        <h1 className="text-2xl font-black">로그인 연결 중</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          이메일 링크의 로그인 정보를 확인하고 있습니다.
        </p>
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackContent />
    </Suspense>
  );
}
