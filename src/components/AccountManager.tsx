"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import DeviceProfileCard from "@/components/DeviceProfileCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getSupabaseBrowserConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getUserProfile, saveUserProfile } from "@/lib/userProfileStorage";
import { RegisteredDevice, UserProfileRecord } from "@/types/device";
import { UserProfile } from "@/types/userProfile";
import { TravelMode } from "@/types/calendar";

type OAuthProvider = "google" | "apple" | "kakao";

const TRAVEL_MODE_OPTIONS: Array<{ value: TravelMode; label: string }> = [
  { value: "walk", label: "도보" },
  { value: "transit", label: "대중교통" },
  { value: "car", label: "자차" },
];

const ENERGY_PATTERN_OPTIONS: Array<{
  value: NonNullable<UserProfile["energyPattern"]>;
  label: string;
}> = [
  { value: "morning", label: "오전형" },
  { value: "balanced", label: "균형형" },
  { value: "night", label: "저녁형" },
];

const OAUTH_PROVIDERS: Array<{
  provider: OAuthProvider | "naver";
  label: string;
  setupLabel?: string;
  bgClassName: string;
  textClassName: string;
  enabled: boolean;
}> = [
  {
    provider: "kakao",
    label: "카카오로 계속하기",
    bgClassName: "bg-[#FEE500]",
    textClassName: "text-[#191919]",
    enabled: true,
  },
  {
    provider: "google",
    label: "Google로 계속하기",
    setupLabel: "Google 설정 필요",
    bgClassName: "bg-white ring-1 ring-slate-200",
    textClassName: "text-slate-800",
    enabled: true,
  },
  {
    provider: "apple",
    label: "Apple로 계속하기",
    setupLabel: "Apple 설정 필요",
    bgClassName: "bg-slate-950",
    textClassName: "text-white",
    enabled: true,
  },
  {
    provider: "naver",
    label: "네이버는 설정 준비 중",
    bgClassName: "bg-[#03C75A]",
    textClassName: "text-white",
    enabled: false,
  },
];

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

function getUserDisplayName(user: User | null, fallbackName: string) {
  if (fallbackName.trim()) {
    return fallbackName.trim();
  }

  const metadataName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.preferred_username;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user?.email?.split("@")[0] ?? "사용자";
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "나";
}

function getAuthRedirectUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", window.location.pathname || "/settings");

  return callbackUrl.toString();
}

function getKakaoAuthStartUrl() {
  const startUrl = new URL("/api/auth/kakao/start", window.location.origin);
  startUrl.searchParams.set("next", window.location.pathname || "/account");

  return startUrl.toString();
}

export default function AccountManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [oauthProviderStatus, setOauthProviderStatus] = useState<
    Partial<Record<OAuthProvider, boolean>>
  >({});

  const [displayName, setDisplayName] = useState("");
  const [classificationPreference, setClassificationPreference] = useState("");
  const [preferredTravelMode, setPreferredTravelMode] =
    useState<TravelMode>("transit");
  const [
    travelTimeAutoCalculationEnabled,
    setTravelTimeAutoCalculationEnabled,
  ] = useState(true);
  const [energyPattern, setEnergyPattern] =
    useState<NonNullable<UserProfile["energyPattern"]>>("balanced");
  const [workoutPreferredStartTime, setWorkoutPreferredStartTime] =
    useState("17:00");
  const [workoutPreferredEndTime, setWorkoutPreferredEndTime] =
    useState("21:30");
  const [reservationPreferredStartTime, setReservationPreferredStartTime] =
    useState("10:00");
  const [reservationPreferredEndTime, setReservationPreferredEndTime] =
    useState("20:00");
  const [needsShowerAfterWorkout, setNeedsShowerAfterWorkout] = useState(true);
  const [instantActionAutoOpenEnabled, setInstantActionAutoOpenEnabled] =
    useState(true);
  const [unresolvedDigestEnabled, setUnresolvedDigestEnabled] = useState(true);
  const [unresolvedDigestSnoozedUntil, setUnresolvedDigestSnoozedUntil] =
    useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authError = searchParams.get("auth_error");

    if (authError) {
      setMessage(authError);
    }

    const savedProfile = getUserProfile();
    setLocalProfile(savedProfile);
    setPreferredTravelMode(savedProfile?.preferredTravelMode ?? "transit");
    setTravelTimeAutoCalculationEnabled(
      savedProfile?.travelTimeAutoCalculationEnabled ?? true
    );
    setEnergyPattern(savedProfile?.energyPattern ?? "balanced");
    setWorkoutPreferredStartTime(
      savedProfile?.workoutPreferredStartTime ?? "17:00"
    );
    setWorkoutPreferredEndTime(
      savedProfile?.workoutPreferredEndTime ?? "21:30"
    );
    setReservationPreferredStartTime(
      savedProfile?.reservationPreferredStartTime ?? "10:00"
    );
    setReservationPreferredEndTime(
      savedProfile?.reservationPreferredEndTime ?? "20:00"
    );
    setNeedsShowerAfterWorkout(savedProfile?.needsShowerAfterWorkout ?? true);
    setInstantActionAutoOpenEnabled(
      savedProfile?.instantActionAutoOpenEnabled ?? true
    );
    setUnresolvedDigestEnabled(savedProfile?.unresolvedDigestEnabled ?? true);
    setUnresolvedDigestSnoozedUntil(
      savedProfile?.unresolvedDigestSnoozedUntil ?? null
    );
    setDeviceName(getDefaultDeviceName());

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const client = supabase;
    const config = getSupabaseBrowserConfig();

    async function loadOAuthProviderStatus() {
      if (!config) return;

      try {
        const response = await fetch(`${config.url}/auth/v1/settings`, {
          headers: {
            apikey: config.publishableKey,
          },
        });
        const data = (await response.json()) as {
          external?: Partial<Record<OAuthProvider, boolean>>;
        };

        setOauthProviderStatus({
          apple: data.external?.apple,
          google: data.external?.google,
          kakao: data.external?.kakao,
        });
      } catch {
        setOauthProviderStatus({});
      }
    }

    async function loadAuthState() {
      const { data: sessionData } = await client.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      if (sessionUser) {
        setUser(sessionUser);
        await ensureProfileAndDevice(sessionUser);
        setIsLoading(false);
        return;
      }

      const { data: userData } = await client.auth.getUser();
      setUser(userData.user);

      if (userData.user) {
        await ensureProfileAndDevice(userData.user);
      }

      setIsLoading(false);
    }

    loadAuthState();
    loadOAuthProviderStatus();

    const { data: listener } = client.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          await ensureProfileAndDevice(nextUser);
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
      setPreferredTravelMode(profile.preferred_travel_mode ?? "transit");
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

  async function ensureProfileAndDevice(nextUser: User) {
    if (!supabase) return;

    const defaultName = getUserDisplayName(nextUser, "");
    const now = new Date().toISOString();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", nextUser.id)
      .maybeSingle<UserProfileRecord>();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: nextUser.id,
        display_name: displayName.trim() || defaultName,
        classification_preference: classificationPreference.trim(),
        preferred_travel_mode: preferredTravelMode,
        updated_at: now,
      });
    } else {
      setDisplayName(existingProfile.display_name ?? "");
      setClassificationPreference(
        existingProfile.classification_preference ?? ""
      );
      setPreferredTravelMode(
        existingProfile.preferred_travel_mode ?? "transit"
      );
    }

    const { data: existingDevices } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", nextUser.id)
      .eq("user_agent", navigator.userAgent)
      .limit(1);
    const existingDevice = existingDevices?.[0] as RegisteredDevice | undefined;

    if (existingDevice) {
      await supabase
        .from("devices")
        .update({
          device_name: existingDevice.device_name || getDefaultDeviceName(),
          device_type: detectDeviceType(),
          trusted: true,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", existingDevice.id);
    } else {
      await supabase.from("devices").insert({
        user_id: nextUser.id,
        device_name: deviceName.trim() || getDefaultDeviceName(),
        device_type: detectDeviceType(),
        user_agent: navigator.userAgent,
        trusted: true,
        last_seen_at: now,
      });
    }

    await loadProfileAndDevices(nextUser.id);
  }

  async function handleSendLoginLink() {
    if (!supabase || !email.trim()) return;

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: authMode === "signup",
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      authMode === "signup"
        ? "회원가입 확인 링크를 이메일로 보냈습니다. 같은 기기에서 링크를 열어주세요."
        : "로그인 링크를 이메일로 보냈습니다. 같은 기기에서 링크를 열어주세요."
    );
  }

  async function handleOAuthLogin(provider: OAuthProvider) {
    if (!supabase) return;

    setIsSaving(true);
    setMessage(null);

    if (provider === "kakao") {
      window.location.href = getKakaoAuthStartUrl();
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
    }
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
      preferred_travel_mode: preferredTravelMode,
      updated_at: new Date().toISOString(),
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("사용자 기준을 저장했습니다.");
    const nextLocalProfile = saveUserProfile({
      id: localProfile?.id,
      createdAt: localProfile?.createdAt,
      displayName: displayName.trim() || getUserDisplayName(user, ""),
      deviceLabel: localProfile?.deviceLabel ?? getDefaultDeviceName(),
      classificationPreference: classificationPreference.trim(),
      preferredTravelMode,
      travelTimeAutoCalculationEnabled,
      energyPattern,
      workoutPreferredStartTime,
      workoutPreferredEndTime,
      reservationPreferredStartTime,
      reservationPreferredEndTime,
      needsShowerAfterWorkout,
      instantActionAutoOpenEnabled,
      unresolvedDigestEnabled,
      unresolvedDigestSnoozedUntil,
      rememberDevice: true,
    });
    setLocalProfile(nextLocalProfile);
  }

  function snoozeUnresolvedDigest(days: number) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    setUnresolvedDigestSnoozedUntil(nextDate.toISOString());
    setUnresolvedDigestEnabled(false);
  }

  async function handleRegisterCurrentDevice() {
    if (!supabase || !user) return;

    setIsSaving(true);
    setMessage(null);

    const now = new Date().toISOString();
    const nextDevice = {
      device_name: deviceName.trim() || getDefaultDeviceName(),
      device_type: detectDeviceType(),
      trusted: true,
      last_seen_at: now,
      updated_at: now,
    };

    const { data: existingDevices } = await supabase
      .from("devices")
      .select("id")
      .eq("user_id", user.id)
      .eq("user_agent", navigator.userAgent)
      .limit(1);

    const existingDeviceId = existingDevices?.[0]?.id;
    const { error } = existingDeviceId
      ? await supabase
          .from("devices")
          .update(nextDevice)
          .eq("id", existingDeviceId)
      : await supabase.from("devices").insert({
          user_id: user.id,
          user_agent: navigator.userAgent,
          ...nextDevice,
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
          <p className="mt-3 text-sm font-bold text-slate-500">
            자세한 설정 순서는 docs/supabase-setup.md에 정리되어 있습니다.
          </p>
        </section>

        <DeviceProfileCard profile={localProfile} onChange={setLocalProfile} />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-slate-100">
        <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
          <p className="text-sm font-black text-blue-200">나의 비서 계정</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            {authMode === "signup" ? "회원가입" : "로그인"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            한 번 로그인하면 같은 계정의 기기들이 같은 사용자로 연결됩니다.
          </p>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            {(["signup", "login"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAuthMode(mode)}
                className={`rounded-xl px-3 py-2 text-sm font-black transition ${
                  authMode === mode
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {mode === "signup" ? "회원가입" : "로그인"}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {OAUTH_PROVIDERS.map((item) => {
              const providerStatus =
                item.provider === "naver"
                  ? false
                  : oauthProviderStatus[item.provider];
              const isProviderEnabled =
                item.enabled && providerStatus !== false;

              return (
                <button
                  key={item.provider}
                  type="button"
                  onClick={() => {
                    if (isProviderEnabled) {
                      handleOAuthLogin(item.provider as OAuthProvider);
                    }
                  }}
                  disabled={!isProviderEnabled || isSaving}
                  className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${item.bgClassName} ${item.textClassName}`}
                >
                  {isProviderEnabled
                    ? item.label
                    : item.setupLabel ?? item.label}
                </button>
              );
            })}
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-black text-slate-300">또는</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="space-y-3">
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
              {authMode === "signup" ? "이메일로 회원가입" : "로그인 링크 받기"}
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
              {message}
            </p>
          )}
        </div>
      </section>
    );
  }

  const visibleName = getUserDisplayName(user, displayName);
  const currentDevice =
    typeof navigator === "undefined"
      ? null
      : devices.find((device) => {
          return device.user_agent === navigator.userAgent;
        });

  return (
    <div className="space-y-4">
      <section className="app-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-fuchsia-500 via-rose-400 to-amber-300 p-[2px]">
              <div className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-black text-slate-950">
                {getInitial(visibleName)}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-900">
                {visibleName}
              </h2>
              <p className="truncate text-sm font-semibold text-slate-400">
                {user.email}
              </p>
              <p className="mt-1 text-xs font-black text-emerald-600">
                {currentDevice ? "현재 기기 연결됨" : "현재 기기 연결 확인 중"}
              </p>
            </div>
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
          <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <h3 className="text-sm font-black text-slate-900">
              앱 사용 방식
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              분류는 단기일정, 메모, 즉시처리로 단순화합니다. 구매와 예약은
              즉시처리 안에서 에이전트가 준비합니다.
            </p>

            <div className="mt-3 space-y-2">
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    즉시처리 자동 사용
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    켜두면 구매, 예약, 연락 요청을 즉시처리 확인함에서 바로
                    처리 후보로 보여줍니다.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={instantActionAutoOpenEnabled}
                  onChange={(event) =>
                    setInstantActionAutoOpenEnabled(event.target.checked)
                  }
                  className="h-5 w-5 shrink-0 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <span>
                  <span className="block text-sm font-black text-slate-900">
                    미확정 일정 알림
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    날짜나 실행 여부가 확정되지 않은 단기일정/즉시처리를 아침과
                    저녁에 다시 알려줍니다.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={unresolvedDigestEnabled}
                  onChange={(event) => {
                    setUnresolvedDigestEnabled(event.target.checked);
                    if (event.target.checked) {
                      setUnresolvedDigestSnoozedUntil(null);
                    }
                  }}
                  className="h-5 w-5 shrink-0 accent-blue-600"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => snoozeUnresolvedDigest(1)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-500 ring-1 ring-slate-100"
                >
                  오늘 알림 멈추기
                </button>
                <button
                  type="button"
                  onClick={() => snoozeUnresolvedDigest(7)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-500 ring-1 ring-slate-100"
                >
                  7일간 멈추기
                </button>
                {unresolvedDigestSnoozedUntil && (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                    {new Date(unresolvedDigestSnoozedUntil).toLocaleDateString(
                      "ko-KR"
                    )}
                    까지 멈춤
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  이동시간 설정
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  일정 사이 장소가 바뀔 때 자동 계산 여부와 기본 이동수단을
                  정합니다. 개별 일정에서는 다시 바꿀 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setTravelTimeAutoCalculationEnabled((current) => !current)
                }
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                  travelTimeAutoCalculationEnabled
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                {travelTimeAutoCalculationEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {TRAVEL_MODE_OPTIONS.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setPreferredTravelMode(mode.value)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black transition ${
                    preferredTravelMode === mode.value
                      ? "bg-slate-950 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-100"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  추천 기준
                </h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  시간작업 추천에서 에너지 수준, 운동 가능 시간, 예약 가능한
                  낮 시간대를 함께 고려합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNeedsShowerAfterWorkout((current) => !current)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                  needsShowerAfterWorkout
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
                }`}
              >
                샤워 {needsShowerAfterWorkout ? "고려" : "제외"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {ENERGY_PATTERN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEnergyPattern(option.value)}
                  className={`rounded-2xl px-3 py-3 text-sm font-black transition ${
                    energyPattern === option.value
                      ? "bg-slate-950 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-500">
                  운동 추천 시간
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={workoutPreferredStartTime}
                    onChange={(event) =>
                      setWorkoutPreferredStartTime(event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                  <input
                    type="time"
                    value={workoutPreferredEndTime}
                    onChange={(event) =>
                      setWorkoutPreferredEndTime(event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                <p className="text-xs font-black text-slate-500">
                  예약 추천 시간
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={reservationPreferredStartTime}
                    onChange={(event) =>
                      setReservationPreferredStartTime(event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                  <input
                    type="time"
                    value={reservationPreferredEndTime}
                    onChange={(event) =>
                      setReservationPreferredEndTime(event.target.value)
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>
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
