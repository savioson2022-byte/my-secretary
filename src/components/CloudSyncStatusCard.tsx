"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCloudDataSyncedEventName,
  getCloudSyncStatus,
  type CloudSyncStatus,
} from "@/lib/dataSyncEvents";

const TABLE_LABELS: Record<string, string> = {
  assistant_items: "저장 기록",
  routine_schedules: "정기 일정",
  single_schedules: "단기 일정",
  places: "장소",
  travel_time_rules: "이동시간 규칙",
  all: "전체",
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusText(status: CloudSyncStatus["status"]) {
  if (status === "success") return "정상 동기화";
  if (status === "partial") return "일부 동기화";
  if (status === "failed") return "동기화 실패";
  return "대기 중";
}

export default function CloudSyncStatusCard() {
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus | null>(null);

  useEffect(() => {
    function refreshStatus() {
      setSyncStatus(getCloudSyncStatus());
    }

    refreshStatus();
    window.addEventListener(getCloudDataSyncedEventName(), refreshStatus);

    return () => {
      window.removeEventListener(getCloudDataSyncedEventName(), refreshStatus);
    };
  }, []);

  const failedResults = useMemo(() => {
    return syncStatus?.results.filter((result) => !result.ok) ?? [];
  }, [syncStatus]);

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">기기 동기화</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            같은 계정으로 로그인한 기기끼리 기록과 일정을 맞춥니다.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
            syncStatus?.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : syncStatus?.status === "partial"
                ? "bg-amber-50 text-amber-700"
                : syncStatus?.status === "failed"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-500"
          }`}
        >
          {syncStatus ? getStatusText(syncStatus.status) : "확인 전"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
        {syncStatus ? (
          <>
            <p>마지막 확인: {formatUpdatedAt(syncStatus.updatedAt)}</p>
            {failedResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                {failedResults.map((result) => (
                  <p key={result.table} className="text-amber-700">
                    {TABLE_LABELS[result.table] ?? result.table}: 다시 확인 필요
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-emerald-700">
                저장 기록, 정기 일정, 단기 일정 동기화가 정상입니다.
              </p>
            )}
          </>
        ) : (
          <p>
            로그인 후 앱을 새로고침하면 동기화 상태가 표시됩니다. 컴퓨터와
            핸드폰이 같은 계정인지도 함께 확인해주세요.
          </p>
        )}
      </div>
    </section>
  );
}
