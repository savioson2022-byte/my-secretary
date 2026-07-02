"use client";

import { useEffect, useState } from "react";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function getDeviceLabel() {
  if (typeof navigator === "undefined") return "휴대폰";

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("iphone")) return "iPhone";
  if (userAgent.includes("ipad")) return "iPad";
  if (userAgent.includes("android")) return "Android";

  return "휴대폰";
}

export default function MobileInstallGuide() {
  const [deviceLabel, setDeviceLabel] = useState("휴대폰");
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setDeviceLabel(getDeviceLabel());
    setIsInstalled(isStandaloneDisplay());
  }, []);

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-600">모바일 사용 준비</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            {deviceLabel}에서 앱처럼 열기
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            isInstalled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {isInstalled ? "설치됨" : "설치 전"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-500 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="font-black text-slate-800">홈 화면 추가</p>
          <p className="mt-1">
            Safari에서 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하면 앱처럼
            실행할 수 있습니다.
          </p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-4 text-blue-700 ring-1 ring-blue-100">
          <p className="font-black">음성 바로가기</p>
          <p className="mt-1">
            주소 뒤에 ?voice=1을 붙인 링크를 단축어, 동작 버튼, 뒷면 탭에
            연결하면 바로 말하기 화면으로 들어갑니다.
          </p>
        </div>
      </div>
    </section>
  );
}
