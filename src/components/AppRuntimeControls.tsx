"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export default function AppRuntimeControls() {
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
  }, []);

  if (!isNativeApp) {
    return null;
  }

  function reloadApp() {
    window.location.reload();
  }

  function openNativeHandoff() {
    window.location.href = "/auth/native-handoff";
  }

  return (
    <section className="app-card p-5">
      <div>
        <p className="text-xs font-black text-blue-600">iPhone 앱</p>
        <h2 className="mt-1 text-lg font-black text-slate-900">
          앱 상태 다시 연결
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          로그인 후 화면이 바뀌지 않거나 오래된 화면이 보이면 앱 화면을 다시
          불러오세요.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={reloadApp}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={openNativeHandoff}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
        >
          로그인 복구
        </button>
      </div>
    </section>
  );
}
