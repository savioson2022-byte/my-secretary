"use client";

import { useState } from "react";

const VOICE_DEEP_LINK = "mysecretary://voice";
const VOICE_WEB_LINK = "https://my-secretary-remote.vercel.app/?voice=1";

export default function ShortcutSetupCard() {
  const [message, setMessage] = useState<string | null>(null);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label}를 복사했어.`);
    } catch {
      setMessage("복사에 실패했어. 주소를 길게 눌러 직접 복사해줘.");
    }
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="bg-slate-950 px-5 py-6 text-white">
        <p className="text-xs font-black text-blue-200">아이폰 빠른 실행</p>
        <h2 className="mt-2 text-xl font-black">
          후면 두 번 탭으로 바로 말하기
        </h2>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
          단축어에서 URL 열기를 만들고, iPhone 설정의 뒷면 탭에 그 단축어를
          연결하면 앱이 열리면서 음성 기록을 바로 시작합니다.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => copyText(VOICE_DEEP_LINK, "앱 음성 기록 주소")}
            className="rounded-3xl bg-blue-600 p-4 text-left text-white"
          >
            <span className="block text-sm font-black">앱 주소 복사</span>
            <span className="mt-2 block break-all text-xs font-bold leading-5 text-blue-100">
              {VOICE_DEEP_LINK}
            </span>
          </button>

          <button
            type="button"
            onClick={() => copyText(VOICE_WEB_LINK, "웹 음성 기록 주소")}
            className="rounded-3xl bg-slate-50 p-4 text-left text-slate-900 ring-1 ring-slate-100"
          >
            <span className="block text-sm font-black">웹 주소 복사</span>
            <span className="mt-2 block break-all text-xs font-bold leading-5 text-slate-500">
              {VOICE_WEB_LINK}
            </span>
          </button>
        </div>

        {message ? (
          <p className="rounded-2xl bg-blue-50 p-3 text-xs font-black text-blue-700 ring-1 ring-blue-100">
            {message}
          </p>
        ) : null}

        <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-black text-slate-900">설정 순서</h3>
          <ol className="mt-3 space-y-2 text-xs font-bold leading-5 text-slate-600">
            <li>1. 단축어 앱을 열고 새 단축어를 만듭니다.</li>
            <li>2. 동작 추가에서 URL 열기를 선택합니다.</li>
            <li>3. URL에 {VOICE_DEEP_LINK}를 붙여넣습니다.</li>
            <li>4. 단축어 이름을 “나의 비서 음성 기록”으로 저장합니다.</li>
            <li>5. 설정 앱에서 손쉬운 사용 → 터치 → 뒷면 탭 → 이 단축어를 선택합니다.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="shortcuts://"
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white no-underline"
          >
            단축어 앱 열기
          </a>
          <a
            href="mysecretary://voice"
            className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 no-underline ring-1 ring-blue-100"
          >
            음성 기록 테스트
          </a>
        </div>
      </div>
    </section>
  );
}
