"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import DeviceProfileCard from "@/components/DeviceProfileCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { ensureUnifiedAccount } from "@/lib/unifiedAccount";
import { getUserProfile, saveUserProfile } from "@/lib/userProfileStorage";
import { RegisteredDevice, UserProfileRecord } from "@/types/device";
import { UserProfile } from "@/types/userProfile";
import { TravelMode } from "@/types/calendar";
import type { UnifiedAccountState } from "@/types/unifiedAccount";

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

const AUTH_EMAIL_COOLDOWN_KEY = "my-secretary-auth-email-sent-at";
const AUTH_EMAIL_COOLDOWN_MS = 90_000;
const DEVICE_ID_KEY = "my-secretary-stable-device-id";
const DEVICE_USER_AGENT_PREFIX = "my-secretary-device:";


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

function getEmailConfirmationUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", window.location.pathname || "/account");

  return callbackUrl.toString();
}

function getPasswordResetRedirectUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", "/account?reset_password=1");

  return callbackUrl.toString();
}

function normalizeLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

function isValidLoginId(loginId: string) {
  return /^[a-z0-9_]{4,24}$/.test(normalizeLoginId(loginId));
}

function getLoginIdFromUser(user: User) {
  const loginId = user.user_metadata?.login_id;

  if (typeof loginId === "string" && loginId.trim()) {
    return normalizeLoginId(loginId);
  }

  return null;
}

function getAuthEmailCooldownSeconds() {
  if (typeof window === "undefined") return null;

  const lastSentAt = Number(window.localStorage.getItem(AUTH_EMAIL_COOLDOWN_KEY));

  if (!Number.isFinite(lastSentAt) || lastSentAt <= 0) return null;

  const remainingMs = AUTH_EMAIL_COOLDOWN_MS - (Date.now() - lastSentAt);

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : null;
}

function rememberAuthEmailSent() {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUTH_EMAIL_COOLDOWN_KEY, String(Date.now()));
}

function getBrowserUserAgent() {
  if (typeof navigator === "undefined") return "";

  return navigator.userAgent;
}

function getStableDeviceUserAgent() {
  if (typeof window === "undefined") return "";

  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return `${DEVICE_USER_AGENT_PREFIX}${deviceId}`;
}

function getCurrentDeviceUserAgentCandidates() {
  const stableDeviceUserAgent = getStableDeviceUserAgent();
  const browserUserAgent = getBrowserUserAgent();

  return Array.from(
    new Set([stableDeviceUserAgent, browserUserAgent].filter(Boolean))
  );
}

function clearPasswordResetUrlFlag() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("reset_password");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function AccountManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const configured = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [loginId, setLoginId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordResetMode, setPasswordResetMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
  const [unifiedAccount, setUnifiedAccount] =
    useState<UnifiedAccountState | null>(null);
  const [unifiedAccountMessage, setUnifiedAccountMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authError = searchParams.get("auth_error");

    if (authError) {
      setMessage(authError);
    }

    if (searchParams.get("reset_password") === "1") {
      setPasswordResetMode(true);
      setMessage("새 비밀번호를 설정해주세요.");
      clearPasswordResetUrlFlag();
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
    async function loadAuthState() {
      const { data: sessionData } = await client.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      if (sessionUser) {
        setUser(sessionUser);
        setIsLoading(false);
        void ensureProfileAndDevice(sessionUser);
        return;
      }

      setIsLoading(false);
    }

    loadAuthState();

    const { data: listener } = client.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null;

        if (nextUser) {
          setUser(nextUser);
          setIsLoading(false);
          void ensureProfileAndDevice(nextUser);
        } else {
          setUser(null);
          setDevices([]);
          setUnifiedAccount(null);
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

  async function ensureProfileAndDevice(nextUser: User, nextLoginId?: string) {
    if (!supabase) return;

    const defaultName = getUserDisplayName(nextUser, "");
    const now = new Date().toISOString();
    const accountLoginId = nextLoginId ?? getLoginIdFromUser(nextUser) ?? undefined;

    try {
      const nextUnifiedAccount = await ensureUnifiedAccount({
        supabase,
        user: nextUser,
        loginId: accountLoginId,
      });
      setUnifiedAccount(nextUnifiedAccount);
      setUnifiedAccountMessage(null);
    } catch (error) {
      setUnifiedAccount(null);
      setUnifiedAccountMessage(
        error instanceof Error
          ? `통합계정 DB 준비가 필요합니다: ${error.message}`
          : "통합계정 DB 준비가 필요합니다."
      );
    }

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

    const deviceUserAgent = getStableDeviceUserAgent();
    const deviceUserAgentCandidates = getCurrentDeviceUserAgentCandidates();
    const { data: existingDevices } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", nextUser.id)
      .in("user_agent", deviceUserAgentCandidates)
      .order("last_seen_at", {
        ascending: false,
      });
    const existingDevice = existingDevices?.[0] as RegisteredDevice | undefined;

    if (existingDevice) {
      await supabase
        .from("devices")
        .update({
          device_name: existingDevice.device_name || getDefaultDeviceName(),
          device_type: detectDeviceType(),
          user_agent: deviceUserAgent,
          trusted: true,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", existingDevice.id);

      const duplicateDeviceIds =
        existingDevices
          ?.slice(1)
          .map((device) => device.id)
          .filter(Boolean) ?? [];

      if (duplicateDeviceIds.length > 0) {
        await supabase.from("devices").delete().in("id", duplicateDeviceIds);
      }
    } else {
      await supabase.from("devices").insert({
        user_id: nextUser.id,
        device_name: deviceName.trim() || getDefaultDeviceName(),
        device_type: detectDeviceType(),
        user_agent: deviceUserAgent,
        trusted: true,
        last_seen_at: now,
      });
    }

    await loadProfileAndDevices(nextUser.id);
  }

  async function handlePasswordSignup() {
    if (!supabase) return;

    const nextLoginId = normalizeLoginId(loginId);
    const nextEmail = signupEmail.trim().toLowerCase();
    const nextName = signupName.trim();

    if (!isValidLoginId(nextLoginId)) {
      setMessage("아이디는 영문 소문자, 숫자, 밑줄로 4-24자까지 사용할 수 있습니다.");
      return;
    }

    if (!nextEmail || !nextEmail.includes("@")) {
      setMessage("인증 이메일을 정확히 입력해주세요.");
      return;
    }

    if (password.length < 8) {
      setMessage("비밀번호는 8자 이상으로 만들어주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("비밀번호 확인이 서로 다릅니다.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    rememberAuthEmailSent();

    const { data, error } = await supabase.auth.signUp({
      email: nextEmail,
      password,
      options: {
        emailRedirectTo: getEmailConfirmationUrl(),
        data: {
          login_id: nextLoginId,
          display_name: nextName || nextLoginId,
        },
      },
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const nextUser = data.session?.user ?? null;

    if (nextUser) {
      setUser(nextUser);
      await ensureProfileAndDevice(nextUser, nextLoginId);
      setMessage("회원가입과 로그인이 완료됐습니다.");
      return;
    }

    setMessage(
      data.user?.identities?.length === 0
        ? "이미 가입된 이메일일 수 있습니다. 메일이 오지 않으면 로그인 탭에서 기존 아이디로 로그인하거나 아래 재발송을 눌러보세요."
        : "인증 메일을 보냈습니다. 메일 확인 후 이 아이디와 비밀번호로 로그인하세요. 메일이 안 보이면 스팸함도 확인해주세요."
    );
  }

  async function handleResendSignupEmail() {
    if (!supabase) return;

    const cooldownSeconds = getAuthEmailCooldownSeconds();

    if (cooldownSeconds) {
      setMessage(
        `이메일 발송 제한을 피하려고 잠시 막아뒀습니다. ${cooldownSeconds}초 뒤 다시 눌러주세요.`
      );
      return;
    }

    const nextEmail = signupEmail.trim().toLowerCase();

    if (!nextEmail || !nextEmail.includes("@")) {
      setMessage("인증 이메일을 정확히 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    rememberAuthEmailSent();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: nextEmail,
      options: {
        emailRedirectTo: getEmailConfirmationUrl(),
      },
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("인증 메일을 다시 보냈습니다. 받은메일함과 스팸함을 확인해주세요.");
  }

  async function handlePasswordLogin() {
    if (!supabase) return;

    const loginIdentifier = loginId.trim();
    const nextLoginId = normalizeLoginId(loginIdentifier);
    const fallbackEmail = signupEmail.trim().toLowerCase();

    if (!loginIdentifier || !password) {
      setMessage("아이디 또는 이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    let loginEmail = loginIdentifier.includes("@")
      ? loginIdentifier.toLowerCase()
      : "";

    if (!loginEmail) {
      const { data: emailData, error: lookupError } = await supabase.rpc(
        "resolve_app_login_email",
        {
          login_id_input: nextLoginId,
        }
      );

      if (lookupError) {
        setIsSaving(false);
        setMessage(
          "통합계정 DB 적용이 필요합니다. Supabase SQL Editor에 새 마이그레이션을 먼저 실행해주세요."
        );
        return;
      }

      loginEmail =
        typeof emailData === "string" && emailData.trim()
          ? emailData.trim()
          : fallbackEmail.includes("@")
            ? fallbackEmail
            : "";
    }

    if (!loginEmail) {
      setIsSaving(false);
      setMessage(
        "아이디 연결을 아직 찾지 못했습니다. 처음 한 번은 아이디 칸에 가입 이메일을 넣고 로그인해주세요."
      );
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    setIsSaving(false);

    if (error) {
      setMessage(
        error.message.includes("Invalid login credentials")
          ? loginIdentifier.includes("@")
            ? "이메일은 확인했지만 비밀번호가 맞지 않습니다. 비밀번호 재설정 메일을 보낸 뒤, 메일 링크에서 ‘나의 비서 앱으로 돌아가기’를 눌러 새 비밀번호를 저장해주세요."
            : "아이디는 이메일까지 찾았지만 비밀번호가 맞지 않습니다. 아이디 칸에 가입 이메일을 넣고 비밀번호 재설정을 진행해주세요."
          : error.message
      );
      return;
    }

    const nextUser = data.user ?? data.session?.user ?? null;
    setUser(nextUser);

    if (nextUser) {
      await ensureProfileAndDevice(
        nextUser,
        loginIdentifier.includes("@") ? getLoginIdFromUser(nextUser) ?? undefined : nextLoginId
      );
    }

    setMessage("로그인했습니다. 이 기기와 통합계정 연결도 확인했습니다.");
  }

  async function handleSendPasswordResetEmail() {
    if (!supabase) return;

    const cooldownSeconds = getAuthEmailCooldownSeconds();

    if (cooldownSeconds) {
      setMessage(
        `이메일 발송 제한을 피하려고 잠시 막아뒀습니다. ${cooldownSeconds}초 뒤 다시 눌러주세요.`
      );
      return;
    }

    const resetEmail = loginId.trim().includes("@")
      ? loginId.trim().toLowerCase()
      : signupEmail.trim().toLowerCase();

    if (!resetEmail || !resetEmail.includes("@")) {
      setMessage("비밀번호 재설정을 위해 아이디 칸에 가입 이메일을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    rememberAuthEmailSent();

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("비밀번호 재설정 메일을 보냈습니다. 메일 링크를 열어 새 비밀번호를 설정해주세요.");
  }

  async function handleUpdatePassword() {
    if (!supabase || !user) return;

    if (newPassword.length < 8) {
      setMessage("새 비밀번호는 8자 이상으로 만들어주세요.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setMessage("새 비밀번호 확인이 서로 다릅니다.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordResetMode(false);
    clearPasswordResetUrlFlag();
    setMessage("새 비밀번호를 저장했습니다. 다음부터는 이 비밀번호로 로그인하세요.");
  }

  function closePasswordResetMode() {
    setPasswordResetMode(false);
    setNewPassword("");
    setNewPasswordConfirm("");
    clearPasswordResetUrlFlag();
  }

  async function handleCopyAuthSetupSql() {
    const response = await fetch("/api/auth/setup-sql");

    if (!response.ok) {
      setMessage("통합계정 설정 SQL을 불러오지 못했습니다.");
      return;
    }

    const sql = await response.text();
    await navigator.clipboard.writeText(sql);
    setMessage("통합계정 설정 SQL을 복사했습니다. Supabase SQL Editor에서 실행해주세요.");
  }

  async function handleSignOut() {
    if (!supabase) {
      setUser(null);
      setDevices([]);
      setUnifiedAccount(null);
      setMessage("로그아웃했습니다.");
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setDevices([]);
    setUnifiedAccount(null);
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
    const deviceUserAgent = getStableDeviceUserAgent();
    const deviceUserAgentCandidates = getCurrentDeviceUserAgentCandidates();
    const nextDevice = {
      device_name: deviceName.trim() || getDefaultDeviceName(),
      device_type: detectDeviceType(),
      user_agent: deviceUserAgent,
      trusted: true,
      last_seen_at: now,
      updated_at: now,
    };

    const { data: existingDevices } = await supabase
      .from("devices")
      .select("id")
      .eq("user_id", user.id)
      .in("user_agent", deviceUserAgentCandidates)
      .order("last_seen_at", {
        ascending: false,
      });

    const existingDeviceId = existingDevices?.[0]?.id;
    const { error } = existingDeviceId
      ? await supabase
          .from("devices")
          .update(nextDevice)
          .eq("id", existingDeviceId)
      : await supabase.from("devices").insert({
          user_id: user.id,
          ...nextDevice,
        });

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const duplicateDeviceIds =
      existingDevices
        ?.slice(1)
        .map((device) => device.id)
        .filter(Boolean) ?? [];

    if (duplicateDeviceIds.length > 0) {
      await supabase.from("devices").delete().in("id", duplicateDeviceIds);
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
            로그인은 임시 계정 없이 실제 계정으로만 처리합니다.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
            <p>NEXT_PUBLIC_SUPABASE_URL</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-500">
            자세한 설정 순서는 docs/supabase-setup.md에 정리되어 있습니다.
          </p>
        </section>

        <DeviceProfileCard profile={localProfile} />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-slate-100">
        <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
          <p className="text-sm font-black text-blue-200">나의 비서 계정</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            {authMode === "signup" ? "통합계정 만들기" : "아이디로 로그인"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            앱 안에서는 아이디와 비밀번호로 로그인합니다. 아이디 연결 전에는
            가입 이메일로도 로그인할 수 있습니다.
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

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-black text-slate-500">
                {authMode === "signup" ? "아이디" : "아이디 또는 이메일"}
              </span>
              <input
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                placeholder={
                  authMode === "signup"
                    ? "예: mysecretary"
                    : "아이디 또는 가입 이메일"
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </label>

            {authMode === "signup" && (
              <>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    인증 이메일
                  </span>
                  <input
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="이메일 확인용"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    이름 또는 별명
                  </span>
                  <input
                    value={signupName}
                    onChange={(event) => setSignupName(event.target.value)}
                    autoComplete="name"
                    placeholder="프로필에 표시할 이름"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="text-xs font-black text-slate-500">
                비밀번호
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={
                  authMode === "signup" ? "new-password" : "current-password"
                }
                placeholder="8자 이상"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </label>

            {authMode === "signup" && (
              <label className="block">
                <span className="text-xs font-black text-slate-500">
                  비밀번호 확인
                </span>
                <input
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="한 번 더 입력"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                />
              </label>
            )}

            <button
              type="button"
              onClick={
                authMode === "signup"
                  ? handlePasswordSignup
                  : handlePasswordLogin
              }
              disabled={
                isSaving ||
                !loginId.trim() ||
                !password.trim() ||
                (authMode === "signup" &&
                  (!signupEmail.trim() || !passwordConfirm.trim()))
              }
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:bg-slate-300"
            >
              {authMode === "signup" ? "통합계정 만들기" : "로그인"}
            </button>

            {authMode === "signup" && (
              <button
                type="button"
                onClick={handleResendSignupEmail}
                disabled={isSaving || !signupEmail.trim()}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:text-slate-300"
              >
                인증 메일 다시 보내기
              </button>
            )}

            {authMode === "login" && (
              <button
                type="button"
                onClick={handleSendPasswordResetEmail}
                disabled={isSaving || !loginId.trim()}
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:text-slate-300"
              >
                비밀번호 재설정 메일 보내기
              </button>
            )}

            <p className="rounded-2xl bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-700 ring-1 ring-blue-100">
              이메일 링크를 누르면 웹에서 확인된 뒤 앱으로 돌아가기 버튼이
              표시됩니다. 앱에서 비회원으로 보이면 그 버튼을 눌러 세션을 앱에
              저장해주세요.
            </p>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <p className="text-xs font-black text-slate-500">
              카카오, 네이버, Google로 시작하기
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              다음 단계에서 이 버튼들은 이메일 인증을 줄이는 용도로만 다시
              연결합니다. 최종 로그인 기준은 지금 만든 앱 아이디입니다.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["카카오", "네이버", "Google"].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="rounded-2xl bg-white px-3 py-3 text-xs font-black text-slate-400 ring-1 ring-slate-100"
                >
                  {label}
                </button>
              ))}
            </div>
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
  const currentDeviceUserAgentCandidates =
    typeof window === "undefined" ? [] : getCurrentDeviceUserAgentCandidates();
  const currentDevice =
    currentDeviceUserAgentCandidates.length === 0
      ? null
      : devices.find((device) => {
          return currentDeviceUserAgentCandidates.includes(device.user_agent);
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
                {currentDevice
                    ? "현재 기기 연결됨"
                    : "현재 기기 연결 확인 중"}
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

        <div className="mt-4 rounded-3xl bg-blue-50 p-4 ring-1 ring-blue-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-600">
                통합계정
              </p>
              <h3 className="mt-1 text-sm font-black text-slate-900">
                {unifiedAccount
                  ? "이 로그인은 통합계정에 연결됐습니다."
                  : "통합계정 연결 준비 중"}
              </h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                카카오, Google, Apple, 이메일 로그인을 하나의 앱 계정으로
                묶기 위한 기반입니다.
              </p>
            </div>
            {unifiedAccount?.identity.provider ? (
              <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                {unifiedAccount.identity.provider}
              </span>
            ) : null}
          </div>

          {unifiedAccount ? (
            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-2">
              <p className="rounded-2xl bg-white px-3 py-2 ring-1 ring-blue-100">
                계정 ID {unifiedAccount.account.id.slice(0, 8)}
              </p>
              <p className="rounded-2xl bg-white px-3 py-2 ring-1 ring-blue-100">
                로그인 경로 {unifiedAccount.identity.provider}
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-amber-100">
              <p className="text-xs font-bold leading-5 text-amber-700">
                {unifiedAccountMessage ??
                  "Supabase에 통합계정 테이블이 적용되면 자동 연결됩니다."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyAuthSetupSql}
                  className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100"
                >
                  설정 SQL 복사
                </button>
                <a
                  href="https://supabase.com/dashboard/project/fesrtvxmqalkispmmhro/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-slate-950 px-3 py-2 text-center text-xs font-black text-white"
                >
                  SQL Editor
                </a>
              </div>
            </div>
          )}
        </div>

        {passwordResetMode && (
          <div className="mt-4 rounded-3xl bg-slate-950 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-200">
                  비밀번호 재설정
                </p>
                <h3 className="mt-1 text-base font-black">
                  새 비밀번호 만들기
                </h3>
              </div>
              <button
                type="button"
                onClick={closePasswordResetMode}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200"
              >
                닫기
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
              앞으로 앱에서 사용할 비밀번호를 다시 설정합니다.
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="새 비밀번호"
                className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-300"
              />
              <input
                value={newPasswordConfirm}
                onChange={(event) =>
                  setNewPasswordConfirm(event.target.value)
                }
                type="password"
                autoComplete="new-password"
                placeholder="새 비밀번호 확인"
                className="w-full rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-300"
              />
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={
                  isSaving || !newPassword.trim() || !newPasswordConfirm.trim()
                }
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:bg-slate-500"
              >
                새 비밀번호 저장
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="이름 또는 별명"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-700 ring-1 ring-blue-100">
            AI 분류 기준은 결과에서 맞음 또는 수정 후 저장을 누르면 자동으로
            학습됩니다. 긴 기준 문장을 따로 입력할 필요가 없습니다.
          </div>
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
