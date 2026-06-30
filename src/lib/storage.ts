import { AssistantItem } from "@/types/assistant";

const STORAGE_KEY = "my-assistant-items";

export function getItems(): AssistantItem[] {
  if (typeof window === "undefined") return [];

  const rawItems = window.localStorage.getItem(STORAGE_KEY);
  if (!rawItems) return [];

  try {
    const parsed = JSON.parse(rawItems);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItem(item: AssistantItem) {
  const items = getItems();
  const nextItems = [item, ...items];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
}

export function updateItem(updatedItem: AssistantItem) {
  const items = getItems();
  const nextItems = items.map((item) =>
    item.id === updatedItem.id ? updatedItem : item
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
}

export function deleteItem(id: string) {
  const items = getItems();
  const nextItems = items.filter((item) => item.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
}
