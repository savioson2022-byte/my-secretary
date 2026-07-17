"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@/types/userProfile";

type DeviceProfileCardProps = {
  profile: UserProfile | null;
};

export default function DeviceProfileCard({
  profile,
}: DeviceProfileCardProps) {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setDisplayName(profile?.displayName ?? "사용자");
  }, [profile]);

  return (
    <section className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">현재 기기</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            로그인하면 이 기기는 계정에 자동 연결되고 같은 AI 기준을 사용합니다.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
            profile
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          {profile ? "계정 연결됨" : "로그인 필요"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <p className="text-sm font-black text-slate-900">{displayName}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          별도의 기기 등록이나 분류 기준 입력은 필요하지 않습니다.
        </p>
      </div>
    </section>
  );
}
