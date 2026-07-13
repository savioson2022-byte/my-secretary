"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LOCAL_APP_SESSION_KEY = "my-secretary-local-app-session";
const LOCAL_APP_SESSION_CHANGED_EVENT = "my-secretary-local-app-session-changed";

type LocalAppSession = {
  displayName?: string;
  email?: string;
  loginId?: string;
};

function getDisplayName(user: User | null, profileName: string) {
  if (profileName.trim()) {
    return profileName.trim();
  }

  const metadataName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.preferred_username;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user?.email?.split("@")[0] ?? "비회원";
}

function getLocalSession() {
  if (typeof window === "undefined") return null;

  try {
    const rawSession = window.localStorage.getItem(LOCAL_APP_SESSION_KEY);
    return rawSession ? (JSON.parse(rawSession) as LocalAppSession) : null;
  } catch {
    return null;
  }
}

export default function UserStatusBadge() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [localSession, setLocalSession] = useState<LocalAppSession | null>(
    null
  );

  useEffect(() => {
    function loadLocalSession() {
      setLocalSession(getLocalSession());
    }

    loadLocalSession();
    window.addEventListener(LOCAL_APP_SESSION_CHANGED_EVENT, loadLocalSession);
    window.addEventListener("storage", loadLocalSession);

    if (!supabase) {
      return () => {
        window.removeEventListener(
          LOCAL_APP_SESSION_CHANGED_EVENT,
          loadLocalSession
        );
        window.removeEventListener("storage", loadLocalSession);
      };
    }

    async function loadUser() {
      if (!supabase) return;

      const { data } = await supabase.auth.getUser();
      const nextUser = data.user;
      setUser(nextUser);

      if (!nextUser) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", nextUser.id)
        .maybeSingle<{ display_name: string }>();

      setProfileName(profile?.display_name ?? "");
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener(
        LOCAL_APP_SESSION_CHANGED_EVENT,
        loadLocalSession
      );
      window.removeEventListener("storage", loadLocalSession);
    };
  }, [supabase]);

  const displayName =
    user || !localSession
      ? getDisplayName(user, profileName)
      : localSession.displayName?.trim() ||
        localSession.loginId?.trim() ||
        "사용자";
  const initial = displayName.slice(0, 1).toUpperCase() || "나";

  return (
    <Link
      href="/account"
      aria-label="계정과 기기 관리로 이동"
      className="flex max-w-[180px] shrink-0 items-center gap-2 rounded-full bg-white px-2 py-1.5 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50"
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-fuchsia-500 via-rose-400 to-amber-300 p-[2px]">
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-xs font-black text-slate-950">
          {initial}
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-slate-900">
          {displayName}
        </p>
        <p className="text-[10px] font-bold text-slate-400">
          {user ? "로그인됨" : localSession ? "바로 시작" : "로그인 필요"}
        </p>
      </div>
    </Link>
  );
}
