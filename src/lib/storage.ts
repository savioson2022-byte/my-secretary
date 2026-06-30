import { AssistantItem } from "@/types/assistant";
import { createLocalStorageRepository } from "@/lib/localStorageRepository";

const STORAGE_KEY = "my-assistant-items";
const assistantItemRepository =
  createLocalStorageRepository<AssistantItem>(STORAGE_KEY);

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
