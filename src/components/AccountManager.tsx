"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import DeviceProfileCard from "@/components/DeviceProfileCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUserProfile } from "@/lib/userProfileStorage";
import { RegisteredDevice, UserProfileRecord } from "@/types/device";
import { UserProfile } from "@/types/userProfile";

function detectDeviceType() {
  if (typeof navigator === "undefined") return "unknown";

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes("iphone")) return "iPhone";
  if (userAgent.includes("ipad")) return "iPad";
  if (userAgent.includes("mac")) return "Mac";
  if (userAgent.includes("android")) return "Android";

  return "Web";
}

function getDefaultDeviceName() {
  const type = detectDeviceType();

  if (type === "iPhone") return "내 iPhone";
  if (type === "iPad") return "내 iPad";
  if (type === "Mac") return "내 Mac";

  return "내 기기";
}

export default function AccountManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [classificationPreference, setClassificationPreference] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setLocalProfile(getUserProfile());
    setDeviceName(getDefaultDeviceName());

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const client = supabase;

    async function loadAuthState() {
      const { data } = await client.auth.getUser();
      setUser(data.user);

      if (data.user) {
        await loadProfileAndDevices(data.user.id);
      }

      setIsLoading(false);
    }

    loadAuthState();

    const { data: listener } = client.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          await loadProfileAndDevices(nextUser.id);
        } else {
          setDevices([]);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function loadProfileAndDevices(userId: string) {
    if (!supabase) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<UserProfileRecord>();

    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setClassificationPreference(profile.classification_preference ?? "");
    }

    const { data: nextDevices } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", userId)
      .order("last_seen_at", {
        ascending: false,
      });

    setDevices((nextDevices as RegisteredDevice[] | null) ?? []);
  }

  async function handleSendLoginLink() {
    if (!supabase || !email.trim()) return;

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("로그인 링크를 이메일로 보냈습니다. 같은 기기에서 링크를 열어주세요.");
  }

  async function handleSignOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    setUser(null);
    setDevices([]);
    setMessage("로그아웃했습니다.");
  }

  async function handleSaveProfile() {
    if (!supabase || !user) return;

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName.trim(),
      classification_preference: classificationPreference.trim(),
      updated_at: new Date().toISOString(),
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("사용자 기준을 저장했습니다.");
  }

  async function handleRegisterCurrentDevice() {
    if (!supabase || !user) return;

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("devices").insert({
      user_id: user.id,
      device_name: deviceName.trim() || getDefaultDeviceName(),
      device_type: detectDeviceType(),
      user_agent: navigator.userAgent,
      trusted: true,
      last_seen_at: new Date().toISOString(),
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("현재 기기를 이 사용자에게 연결했습니다.");
    await loadProfileAndDevices(user.id);
  }

  async function handleDeleteDevice(deviceId: string) {
    if (!supabase || !user) return;

    const { error } = await supabase.from("devices").delete().eq("id", deviceId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadProfileAndDevices(user.id);
  }

  if (isLoading) {
    return (
      <section className="app-card p-5 text-sm font-black text-slate-500">
        계정 상태를 확인하는 중입니다...
      </section>
    );
  }

  if (!configured || !supabase) {
    return (
      <div className="space-y-4">
        <section className="app-card p-5">
          <h2 className="text-lg font-black text-slate-900">
            Supabase 연결 필요
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            모든 기기를 같은 사용자로 묶으려면 Supabase Auth와 DB가 필요합니다.
            지금은 이 브라우저에만 저장되는 임시 프로필을 사용할 수 있습니다.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
            <p>NEXT_PUBLIC_SUPABASE_URL</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
          </div>
        </section>

        <DeviceProfileCard profile={localProfile} onChange={setLocalProfile} />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="app-card p-5">
        <h2 className="text-lg font-black text-slate-900">로그인</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          이메일 링크로 로그인하면 이 기기를 같은 사용자 계정에 연결할 수
          있습니다.
        </p>

        <div className="mt-4 space-y-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleSendLoginLink}
            disabled={isSaving || !email.trim()}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:bg-slate-300"
          >
            로그인 링크 받기
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
            {message}
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              사용자 계정
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-200"
          >
            로그아웃
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="이름 또는 별명"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
          <textarea
            value={classificationPreference}
            onChange={(event) =>
              setClassificationPreference(event.target.value)
            }
            placeholder="사용자별 AI 분류 기준"
            className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          >
            사용자 기준 저장
          </button>
        </div>
      </section>

      <section className="app-card p-5">
        <h3 className="font-black text-slate-900">내 기기 관리</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          같은 계정으로 로그인한 기기는 같은 사용자로 인식됩니다.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="기기 이름"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleRegisterCurrentDevice}
            disabled={isSaving}
            className="shrink-0 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:bg-slate-300"
          >
            연결
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {devices.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
              아직 연결된 기기가 없습니다.
            </p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
              >
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {device.device_name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {device.device_type} · 마지막 접속{" "}
                    {new Date(device.last_seen_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteDevice(device.id)}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {message && (
        <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
          {message}
        </p>
      )}
    </div>
  );
}
