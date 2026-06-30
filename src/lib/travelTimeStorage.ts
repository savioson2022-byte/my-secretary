import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { TravelTimeRule } from "@/types/calendar";

const TRAVEL_TIME_RULE_STORAGE_KEY = "my-assistant-travel-time-rules";
const travelTimeRuleRepository =
  createLocalStorageRepository<TravelTimeRule>(TRAVEL_TIME_RULE_STORAGE_KEY);

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
