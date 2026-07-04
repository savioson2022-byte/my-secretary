"use client";

import { FormEvent, useEffect, useState } from "react";
import { saveUserProfile } from "@/lib/userProfileStorage";
import { UserProfile } from "@/types/userProfile";

type DeviceProfileCardProps = {
  profile: UserProfile | null;
  onChange: (profile: UserProfile) => void;
};

export default function DeviceProfileCard({
  profile,
  onChange,
}: DeviceProfileCardProps) {
  const [displayName, setDisplayName] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [classificationPreference, setClassificationPreference] = useState("");

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setDeviceLabel(profile?.deviceLabel ?? "");
    setClassificationPreference(profile?.classificationPreference ?? "");
  }, [profile]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextProfile = saveUserProfile({
      id: profile?.id,
      createdAt: profile?.createdAt,
      displayName: displayName.trim() || "사용자",
      deviceLabel: deviceLabel.trim() || "내 휴대폰",
      classificationPreference: classificationPreference.trim(),
      preferredTravelMode: profile?.preferredTravelMode,
      travelTimeAutoCalculationEnabled:
        profile?.travelTimeAutoCalculationEnabled,
      rememberDevice: true,
    });

    onChange(nextProfile);
  }

  return (
    <section className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900">기기 등록</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            이 기기를 기억하고, 분류 기준을 사용자에게 맞춥니다.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
            profile
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          {profile ? "등록됨" : "미등록"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="이름 또는 별명"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
        />
        <input
          value={deviceLabel}
          onChange={(event) => setDeviceLabel(event.target.value)}
          placeholder="기기 이름: 내 아이폰, 학교용 아이패드"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
        />
        <textarea
          value={classificationPreference}
          onChange={(event) => setClassificationPreference(event.target.value)}
          placeholder="분류 기준 예: 학원/병원/약속은 일정으로, 공부할 내용은 시간작업으로 분류해줘"
          className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
        >
          이 기기 기억하기
        </button>
      </form>
    </section>
  );
}
