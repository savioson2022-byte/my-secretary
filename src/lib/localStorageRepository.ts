import { getScopedStorageKey } from "@/lib/authScopedStorage";

export type LocalStorageRepository<TItem extends { id: string }> = {
  list: () => TItem[];
  create: (item: TItem) => void;
  update: (item: TItem) => void;
  delete: (id: string) => void;
};

const LOCAL_DATA_UPDATED_EVENT = "assistant-local-data-updated";

export function isBrowser() {
  return typeof window !== "undefined";
}

export function getLocalDataUpdatedEventName() {
  return LOCAL_DATA_UPDATED_EVENT;
}

export function readLocalStorageArray<TItem>(key: string): TItem[] {
  if (!isBrowser()) {
    return [];
  }

  const scopedKey = getScopedStorageKey(key);
  const rawValue = window.localStorage.getItem(scopedKey);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue;
  } catch {
    return [];
  }
}

export function writeLocalStorageArray<TItem>(key: string, value: TItem[]) {
  if (!isBrowser()) {
    return;
  }

  const scopedKey = getScopedStorageKey(key);
  window.localStorage.setItem(scopedKey, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent(LOCAL_DATA_UPDATED_EVENT, {
      detail: {
        key,
        scopedKey,
      },
    })
  );
}

export function createLocalStorageRepository<TItem extends { id: string }>(
  key: string
): LocalStorageRepository<TItem> {
  return {
    list() {
      return readLocalStorageArray<TItem>(key);
    },

    create(item) {
      writeLocalStorageArray(key, [item, ...readLocalStorageArray<TItem>(key)]);
    },

    update(updatedItem) {
      const nextItems = readLocalStorageArray<TItem>(key).map((item) => {
        if (item.id === updatedItem.id) {
          return updatedItem;
        }

        return item;
      });

      writeLocalStorageArray(key, nextItems);
    },

    delete(id) {
      const nextItems = readLocalStorageArray<TItem>(key).filter((item) => {
        return item.id !== id;
      });

      writeLocalStorageArray(key, nextItems);
    },
  };
}
