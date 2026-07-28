import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { TravelTimeEstimate, TravelTimeRule } from "@/types/calendar";

export const TRAVEL_MODE_PREFERENCE_MEMO = "[mode-preference]";

const travelTimeRuleRepository =
  createLocalStorageRepository<TravelTimeRule>(STORAGE_KEYS.travelTimeRules);
const travelTimeEstimateRepository =
  createLocalStorageRepository<TravelTimeEstimate>(
    STORAGE_KEYS.travelTimeEstimates
  );

export function getTravelTimeRules(): TravelTimeRule[] {
  return travelTimeRuleRepository.list();
}

export function saveTravelTimeRule(rule: TravelTimeRule) {
  travelTimeRuleRepository.create(rule);
}

export function updateTravelTimeRule(rule: TravelTimeRule) {
  travelTimeRuleRepository.update(rule);
}

export function deleteTravelTimeRule(id: string) {
  travelTimeRuleRepository.delete(id);
}

function normalizePlaceName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function findTravelModePreference({
  fromPlaceName,
  toPlaceName,
}: {
  fromPlaceName: string;
  toPlaceName: string;
}) {
  const from = normalizePlaceName(fromPlaceName);
  const to = normalizePlaceName(toPlaceName);

  return getTravelTimeRules()
    .filter(
      (rule) =>
        normalizePlaceName(rule.fromPlaceName) === from &&
        normalizePlaceName(rule.toPlaceName) === to
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export function saveTravelModePreference({
  fromPlaceName,
  toPlaceName,
  mode,
}: Pick<TravelTimeRule, "fromPlaceName" | "toPlaceName" | "mode">) {
  const existing = findTravelModePreference({ fromPlaceName, toPlaceName });
  const now = new Date().toISOString();
  const nextRule: TravelTimeRule = {
    id:
      existing?.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    fromPlaceName: fromPlaceName.trim(),
    toPlaceName: toPlaceName.trim(),
    mode,
    minutes: existing?.minutes ?? 0,
    memo: `${TRAVEL_MODE_PREFERENCE_MEMO} 사용자가 경로별 이동수단을 직접 교정함`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    updateTravelTimeRule(nextRule);
  } else {
    saveTravelTimeRule(nextRule);
  }
  return nextRule;
}

export function getTravelTimeEstimates(): TravelTimeEstimate[] {
  return travelTimeEstimateRepository.list();
}

export function saveTravelTimeEstimate(estimate: TravelTimeEstimate) {
  const existingEstimate = getTravelTimeEstimates().find((item) => {
    return item.cacheKey === estimate.cacheKey;
  });

  if (existingEstimate) {
    travelTimeEstimateRepository.update({
      ...estimate,
      id: existingEstimate.id,
      createdAt: existingEstimate.createdAt,
    });
    return;
  }

  travelTimeEstimateRepository.create(estimate);
}
