import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { TravelTimeRule } from "@/types/calendar";

const travelTimeRuleRepository =
  createLocalStorageRepository<TravelTimeRule>(STORAGE_KEYS.travelTimeRules);

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
