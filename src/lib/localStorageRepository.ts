import { getScopedStorageKey } from "@/lib/authScopedStorage";

export type LocalStorageRepository<TItem extends { id: string }> = {
  list: () => TItem[];
  create: (item: TItem) => void;
  update: (item: TItem) => void;
  delete: (id: string) => void;
};

const LOCAL_DATA_UPDATED_EVENT = "assistant-local-data-updated";
const DELETED_ITEM_LOG_SUFFIX = "::deleted";

export type DeletedItemRecord = {
  id: string;
  deletedAt: string;
};

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

function getDeletedItemLogKey(key: string) {
  return `${key}${DELETED_ITEM_LOG_SUFFIX}`;
}

export function readDeletedItemRecords(key: string): DeletedItemRecord[] {
  return readLocalStorageArray<DeletedItemRecord>(getDeletedItemLogKey(key));
}

function writeDeletedItemRecords(key: string, records: DeletedItemRecord[]) {
  writeLocalStorageArray(getDeletedItemLogKey(key), records);
}

function rememberDeletedItem(key: string, id: string) {
  const records = readDeletedItemRecords(key);
  const nextRecord = {
    id,
    deletedAt: new Date().toISOString(),
  };
  const nextRecords = [
    nextRecord,
    ...records.filter((record) => record.id !== id),
  ];

  writeDeletedItemRecords(key, nextRecords);
}

function forgetDeletedItem(key: string, id: string) {
  const records = readDeletedItemRecords(key);
  const nextRecords = records.filter((record) => record.id !== id);

  if (nextRecords.length === records.length) {
    return;
  }

  writeDeletedItemRecords(key, nextRecords);
}

export function createLocalStorageRepository<TItem extends { id: string }>(
  key: string
): LocalStorageRepository<TItem> {
  return {
    list() {
      return readLocalStorageArray<TItem>(key);
    },

    create(item) {
      forgetDeletedItem(key, item.id);
      writeLocalStorageArray(key, [item, ...readLocalStorageArray<TItem>(key)]);
    },

    update(updatedItem) {
      forgetDeletedItem(key, updatedItem.id);
      const nextItems = readLocalStorageArray<TItem>(key).map((item) => {
        if (item.id === updatedItem.id) {
          return updatedItem;
        }

        return item;
      });

      writeLocalStorageArray(key, nextItems);
    },

    delete(id) {
      rememberDeletedItem(key, id);
      const nextItems = readLocalStorageArray<TItem>(key).filter((item) => {
        return item.id !== id;
      });

      writeLocalStorageArray(key, nextItems);
    },
  };
}
