"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AgentNextAction } from "@/lib/agentNextAction";

/**
 * 비서가 고른 "지금 할 것 하나".
 *
 * 목록을 늘어놓고 사용자가 고르게 하면 결국 아무것도 안 고른다.
 * 하나만 건네고, 틀렸을 때 치우는 비용을 최대한 낮춘다.
 */

type NextActionCardProps = {
  action: AgentNextAction;
  onApprove: (action: AgentNextAction) => void;
  onSnooze: (action: AgentNextAction) => void;
  onReject: (action: AgentNextAction) => void;
};

const KIND_LABEL: Record<AgentNextAction["kind"], string> = {
  upcoming_schedule: "곧 시작",
  due_today: "오늘까지",
  needs_review: "확인 필요",
  suggested_session: "이때 어때요",
  here_now: "지금 여기",
  clear: "여유",
};

export default function NextActionCard({
  action,
  onApprove,
  onSnooze,
  onReject,
}: NextActionCardProps) {
  const isClear = action.kind === "clear";
  const accent = useMemo(() => {
    switch (action.kind) {
      case "upcoming_schedule":
        return "bg-blue-600";
      case "due_today":
        return "bg-rose-500";
      case "needs_review":
        return "bg-amber-500";
      case "suggested_session":
        return "bg-violet-500";
      case "here_now":
        return "bg-emerald-500";
      default:
        return "bg-slate-400";
    }
  }, [action.kind]);

  return (
    <section className="app-card overflow-hidden p-0">
      <div className="flex items-center gap-2 px-5 pt-5">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-black text-white ${accent}`}
        >
          {KIND_LABEL[action.kind]}
        </span>
        <span className="text-[11px] font-black text-slate-400">
          지금 할 것 하나
        </span>
      </div>

      <div className="px-5 pb-5 pt-3">
        <h2 className="text-xl font-black leading-tight text-slate-950">
          {action.title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {action.body}
        </p>

        {isClear ? (
          <Link
            href="/records"
            className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-600"
          >
            기록 둘러보기
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onApprove(action)}
              className="mt-5 min-h-12 w-full rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(49,130,246,0.22)] transition hover:bg-blue-700"
            >
              {action.approveLabel}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSnooze(action)}
                className="min-h-11 rounded-2xl bg-slate-100 px-4 text-xs font-black text-slate-600 transition hover:bg-slate-200"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={() => onReject(action)}
                className="min-h-11 rounded-2xl bg-slate-50 px-4 text-xs font-black text-slate-400 transition hover:bg-slate-100"
              >
                이건 아니에요
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
