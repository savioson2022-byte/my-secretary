import { getScopedStorageKey } from "@/lib/authScopedStorage";
import { STORAGE_KEYS } from "@/lib/storageKeys";

/**
 * 비서가 건넨 제안을 미루거나 거절한 기록.
 *
 * 미룬 것은 시간이 지나면 다시 올라오고, 거절한 것은 다시 올라오지 않는다.
 * 제안이 틀렸을 때 그것을 치우는 비용이 낮아야 사용자가 알림을 끄지 않는다.
 */

export const AGENT_DECISION_CHANGED_EVENT =
  "my-assistant-agent-decision-changed";

export type AgentDecisionKind = "approved" | "snoozed" | "rejected";

export type AgentDecision = {
  actionId: string;
  kind: AgentDecisionKind;
  /** snoozed일 때 다시 올라올 시각 */
  wakeAt: string | null;
  decidedAt: string;
};

export const DEFAULT_SNOOZE_MINUTES = 120;

function readAll(): AgentDecision[] {
  if (typeof window === "undefined") return [];

  const rawValue = window.localStorage.getItem(
    getScopedStorageKey(STORAGE_KEYS.agentDecisions)
  );

  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as AgentDecision[]) : [];
  } catch {
    return [];
  }
}

function writeAll(decisions: AgentDecision[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEYS.agentDecisions),
    JSON.stringify(decisions)
  );
  window.dispatchEvent(new Event(AGENT_DECISION_CHANGED_EVENT));
}

export function recordAgentDecision({
  actionId,
  kind,
  snoozeMinutes = DEFAULT_SNOOZE_MINUTES,
}: {
  actionId: string;
  kind: AgentDecisionKind;
  snoozeMinutes?: number;
}) {
  const now = new Date();
  const decision: AgentDecision = {
    actionId,
    kind,
    wakeAt:
      kind === "snoozed"
        ? new Date(now.getTime() + snoozeMinutes * 60_000).toISOString()
        : null,
    decidedAt: now.toISOString(),
  };

  writeAll([
    ...readAll().filter((entry) => entry.actionId !== actionId),
    decision,
  ]);

  return decision;
}

/** 지금 화면에 올리면 안 되는 판단들. */
export function getDismissedActionIds(now = new Date()): string[] {
  return readAll()
    .filter((decision) => {
      if (decision.kind === "rejected" || decision.kind === "approved") {
        return true;
      }

      if (!decision.wakeAt) return false;

      return new Date(decision.wakeAt).getTime() > now.getTime();
    })
    .map((decision) => decision.actionId);
}

/** 오래된 기록을 정리한다. 미룬 시각이 지난 것과 30일 지난 것을 버린다. */
export function pruneAgentDecisions(now = new Date()) {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60_000;

  writeAll(
    readAll().filter((decision) => {
      if (new Date(decision.decidedAt).getTime() < cutoff) return false;
      if (decision.kind !== "snoozed") return true;

      return decision.wakeAt
        ? new Date(decision.wakeAt).getTime() > now.getTime()
        : false;
    })
  );
}
