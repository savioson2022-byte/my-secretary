import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { TravelTimeEstimate, TravelTimeRule } from "@/types/calendar";

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
