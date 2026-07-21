"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import {
  deleteGemmaOnDeviceModel,
  installGemmaOnDeviceModel,
  refreshGemmaOnDeviceStatus,
} from "@/lib/local-ai/gemmaAdapter";
import type { LocalAiStatus } from "@/types/personalAi";
import { getGemmaClassificationReadiness } from "@/lib/personalAiMemoryStorage";

export default function GemmaOnDeviceSettingsCard() {
  const [status, setStatus] = useState<LocalAiStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const nativeApp = Capacitor.isNativePlatform();
  const readiness = getGemmaClassificationReadiness();

  const refresh = useCallback(async () => {
    setStatus(await refreshGemmaOnDeviceStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function installModel() {
    setBusy(true);
    setMessage("약 2.6GB 모델을 내려받고 검증하는 중입니다. 앱을 열어 두세요.");
    try {
      await installGemmaOnDeviceModel();
      await refresh();
      setMessage("설치가 완료됐습니다. 이제 지원 작업은 iPhone에서 먼저 처리합니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "모델 설치에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteModel() {
    setBusy(true);
    try {
      await deleteGemmaOnDeviceModel();
      await refresh();
      setMessage("기기 모델을 삭제했습니다. 서버 AI와 기존 규칙은 계속 사용할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black text-blue-600">개인 AI</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">기기용 Gemma 4</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            처음에는 OpenAI가 분류하고, 승인 사례로 Gemma를 병행 평가합니다.
            정확도 기준을 통과하면 기기 안의 Gemma가 자동으로 우선 처리합니다.
            모델은 약 2.6GB의 저장 공간을 사용합니다.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
            status?.available
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {status?.available ? "사용 중" : "미설치"}
        </span>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
        {nativeApp
          ? status?.reason ?? "설치 상태를 확인하고 있습니다."
          : "모델 설치와 실행은 iPhone 앱에서 지원합니다. 웹에서는 서버 AI를 사용합니다."}
      </p>

      <div className="mt-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
        <div className="flex items-center justify-between gap-3 text-xs font-black text-blue-800">
          <span>{readiness.ready ? "Gemma 우선 분류 준비 완료" : "Gemma 학습·평가 진행 중"}</span>
          <span>{readiness.evaluatedCount}/{readiness.requiredCount}회</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-blue-600"
            style={{
              width: `${Math.min(100, (readiness.evaluatedCount / readiness.requiredCount) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-blue-700">
          승인 사례 {readiness.approvalCount}회 · 누적 일치율 {Math.round(readiness.overallAccuracy * 100)}% · 최근 일치율 {Math.round(readiness.recentAccuracy * 100)}%
        </p>
      </div>

      {message && (
        <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
          {message}
        </p>
      )}

      {nativeApp && (
        <div className="mt-4 flex gap-2">
          {status?.modelInstalled ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteModel()}
              className="min-h-12 flex-1 rounded-2xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-600 disabled:opacity-50"
            >
              기기 모델 삭제
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void installModel()}
              className="min-h-12 flex-1 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {busy ? "설치 중" : "Gemma 4 설치"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            상태 확인
          </button>
        </div>
      )}
    </section>
  );
}
