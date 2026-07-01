import { AssistantItem } from "@/types/assistant";
import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";

const assistantItemRepository =
  createLocalStorageRepository<AssistantItem>(STORAGE_KEYS.assistantItems);

export function getItems(): AssistantItem[] {
  return assistantItemRepository.list();
}

export function saveItem(item: AssistantItem) {
  assistantItemRepository.create(item);
}

export function updateItem(updatedItem: AssistantItem) {
  assistantItemRepository.update(updatedItem);
}

export function deleteItem(id: string) {
  assistantItemRepository.delete(id);
}
