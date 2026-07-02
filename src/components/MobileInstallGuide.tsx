"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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

function isIosLikeDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();

  return userAgent.includes("iphone") || userAgent.includes("ipad");
}

function getVoiceShortcutUrl() {
  if (typeof window === "undefined") return "";

  return `${window.location.origin}/?voice=1`;
}

export default function MobileInstallGuide() {
  const [deviceLabel, setDeviceLabel] = useState("휴대폰");
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDeviceLabel(getDeviceLabel());
    setIsInstalled(isStandaloneDisplay());
    setIsIosDevice(isIosLikeDevice());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  async function handleInstall() {
    setMessage(null);

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setMessage("설치가 시작됐습니다.");
        setInstallPrompt(null);
      } else {
        setMessage("설치를 취소했습니다. 언제든 다시 설치할 수 있습니다.");
      }

      return;
    }

    if (isIosDevice) {
      setMessage(
        "iPhone은 웹페이지가 홈 화면 추가를 자동 실행할 수 없습니다. Safari 공유 버튼에서 홈 화면에 추가를 선택해야 합니다."
      );
      return;
    }

    setMessage(
      "이 브라우저는 자동 설치 버튼을 제공하지 않습니다. 브라우저 메뉴에서 앱 설치 또는 홈 화면 추가를 선택해주세요."
    );
  }

  async function handleCopyVoiceUrl() {
    const url = getVoiceShortcutUrl();

    try {
      await navigator.clipboard.writeText(url);
      setMessage("음성 바로가기 주소를 복사했습니다.");
    } catch {
      setMessage(`복사하지 못했습니다. 이 주소를 직접 사용해주세요: ${url}`);
    }
  }

  async function handleShareVoiceUrl() {
    const url = getVoiceShortcutUrl();

    if (!navigator.share) {
      await handleCopyVoiceUrl();
      return;
    }

    try {
      await navigator.share({
        title: "나의 비서 음성 기록",
        text: "말하면 바로 기록하는 나의 비서 음성 입력 링크",
        url,
      });
      setMessage("음성 바로가기 링크를 공유했습니다.");
    } catch {
      setMessage("공유를 취소했습니다.");
    }
  }

  function handleOpenShortcuts() {
    if (typeof window === "undefined") return;

    window.location.href = "shortcuts://";
  }

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

      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-500 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-slate-800">앱처럼 설치</p>
              <p className="mt-1">
                Android와 일부 데스크톱 브라우저는 설치 버튼으로 바로
                진행됩니다. iPhone은 Safari의 공유 메뉴를 사용해야 합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-700"
            >
              설치 시작
            </button>
          </div>

          {isIosDevice && !isInstalled && (
            <ol className="mt-3 space-y-2 text-xs font-bold leading-5 text-slate-500">
              <li>1. Safari에서 이 페이지를 엽니다.</li>
              <li>2. 공유 버튼을 누릅니다.</li>
              <li>3. 홈 화면에 추가를 선택합니다.</li>
            </ol>
          )}
        </div>

        <div className="rounded-2xl bg-blue-50 p-4 text-blue-700 ring-1 ring-blue-100">
          <p className="font-black">음성 바로가기</p>
          <p className="mt-1">
            웹페이지가 iPhone의 동작 버튼, 뒷면 탭, 단축어를 자동으로 바꿀 수는
            없습니다. 대신 바로 쓸 링크를 복사하거나 공유해 단축어에 붙일 수
            있습니다.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleCopyVoiceUrl}
              className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
            >
              링크 복사
            </button>
            <button
              type="button"
              onClick={handleShareVoiceUrl}
              className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"
            >
              공유하기
            </button>
            <button
              type="button"
              onClick={handleOpenShortcuts}
              className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
            >
              단축어 열기
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
        <p className="text-slate-800">최종 사용자에게 가장 편한 방향</p>
        <p className="mt-1">
          배포 후에는 첫 실행 화면에서 설치 안내, 로그인, 마이크 권한 요청을
          순서대로 보여주고, iPhone 사용자는 단축어 템플릿 링크를 제공하는
          방식이 가장 현실적입니다.
        </p>
      </div>

      {message && (
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-700 ring-1 ring-amber-100">
          {message}
        </p>
      )}
    </section>
  );
}
