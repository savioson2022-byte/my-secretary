import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { AssistantItem } from "@/types/assistant";
import type {
  SavedPlace,
  SingleSchedule,
  TravelMode,
  TravelTimeRule,
} from "@/types/calendar";
import type { SuggestionFeedback } from "@/types/suggestionFeedback";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";
import type { DayOfWeek, RoutineSchedule } from "@/types/routine";
import {
  getCloudSyncStatus,
  type CloudSyncDomainResult,
} from "@/lib/dataSyncEvents";
import { getScopedStorageKey } from "@/lib/authScopedStorage";
import { readDeletedItemRecords } from "@/lib/localStorageRepository";

type SyncableItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type SyncDomain<TLocal extends SyncableItem, TRow extends { id: string }> = {
  key: string;
  table: string;
  optionalTable?: boolean;
  optionalColumns?: string[];
  toRow: (
    item: TLocal,
    userId: string,
    availableColumns: Set<string>
  ) => TRow;
  fromRow: (row: Record<string, unknown>) => TLocal;
};

function readLocalArray<TItem>(key: string): TItem[] {
  if (typeof window === "undefined") return [];

  const rawValue = window.localStorage.getItem(getScopedStorageKey(key));
  if (!rawValue) return [];

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeLocalArraySilently<TItem>(key: string, value: TItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getScopedStorageKey(key), JSON.stringify(value));
}

function getKnownRemoteIdsKey(key: string) {
  return `${key}::known-remote-ids`;
}

function readKnownRemoteIds(key: string): string[] {
  return readLocalArray<string>(getKnownRemoteIdsKey(key)).filter(
    (id): id is string => typeof id === "string"
  );
}

function writeKnownRemoteIds(key: string, ids: string[]) {
  writeLocalArraySilently(getKnownRemoteIdsKey(key), Array.from(new Set(ids)));
}

function isOlderThanPreviousSuccessfulSync(item: SyncableItem) {
  const previousSyncStatus = getCloudSyncStatus();

  if (!previousSyncStatus || previousSyncStatus.status !== "success") {
    return false;
  }

  return (
    new Date(item.updatedAt).getTime() <=
    new Date(previousSyncStatus.updatedAt).getTime()
  );
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function asBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function asTravelMode(value: unknown): TravelMode | undefined {
  if (value === "walk" || value === "transit" || value === "car") {
    return value;
  }

  return undefined;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

async function getAvailableOptionalColumns({
  supabase,
  table,
  optionalColumns = [],
}: {
  supabase: SupabaseClient;
  table: string;
  optionalColumns?: string[];
}) {
  const availableColumns = new Set<string>();

  for (const column of optionalColumns) {
    const { error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .limit(1);

    if (!error) {
      availableColumns.add(column);
    }
  }

  return availableColumns;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function toTimeText(value: unknown) {
  const text = asText(value);
  return text.slice(0, 5);
}

function chooseLatest<TItem extends SyncableItem>(
  currentItem: TItem | undefined,
  nextItem: TItem
) {
  if (!currentItem) return nextItem;

  return new Date(nextItem.updatedAt).getTime() >
    new Date(currentItem.updatedAt).getTime()
    ? nextItem
    : currentItem;
}

function mergeByUpdatedAt<TItem extends SyncableItem>(
  localItems: TItem[],
  remoteItems: TItem[]
) {
  const itemMap = new Map<string, TItem>();

  [...remoteItems, ...localItems].forEach((item) => {
    itemMap.set(item.id, chooseLatest(itemMap.get(item.id), item));
  });

  return Array.from(itemMap.values()).sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

const syncDomains: Array<SyncDomain<SyncableItem, { id: string }>> = [
  {
    key: STORAGE_KEYS.assistantItems,
    table: "assistant_items",
    optionalColumns: [
      "color",
      "idea_group_id",
      "idea_group_title",
      "idea_subcategory",
      "purchase_product_name",
      "purchase_platform",
    ],
    toRow(item, userId, availableColumns) {
      const assistantItem = item as AssistantItem;

      const row = {
        id: assistantItem.id,
        user_id: userId,
        original_text: assistantItem.originalText,
        title: assistantItem.title,
        category: assistantItem.category,
        action_type: assistantItem.actionType,
        process_type: assistantItem.processType,
        priority: assistantItem.priority,
        repeat_type: assistantItem.repeatType,
        status: assistantItem.status,
        estimated_minutes: assistantItem.estimatedMinutes,
        due_date: assistantItem.dueDate,
        reminder_date: assistantItem.reminderDate,
        schedule_start_time: assistantItem.scheduleStartTime ?? null,
        schedule_end_time: assistantItem.scheduleEndTime ?? null,
        created_at: assistantItem.createdAt,
        updated_at: assistantItem.updatedAt,
      };

      if (availableColumns.has("color")) {
        Object.assign(row, {
          color: assistantItem.color ?? null,
        });
      }

      if (availableColumns.has("idea_group_id")) {
        Object.assign(row, {
          idea_group_id: assistantItem.ideaGroupId ?? null,
        });
      }

      if (availableColumns.has("idea_group_title")) {
        Object.assign(row, {
          idea_group_title: assistantItem.ideaGroupTitle ?? null,
        });
      }

      if (availableColumns.has("idea_subcategory")) {
        Object.assign(row, {
          idea_subcategory: assistantItem.ideaSubcategory ?? null,
        });
      }

      if (availableColumns.has("purchase_product_name")) {
        Object.assign(row, {
          purchase_product_name: assistantItem.purchaseProductName ?? null,
        });
      }

      if (availableColumns.has("purchase_platform")) {
        Object.assign(row, {
          purchase_platform: assistantItem.purchasePlatform ?? null,
        });
      }

      return row;
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        originalText: asText(row.original_text),
        title: asText(row.title),
        category: asText(row.category, "기타"),
        actionType: asText(row.action_type, "기타"),
        processType: asText(row.process_type, "메모"),
        priority: asText(row.priority, "보통"),
        repeatType: asText(row.repeat_type, "일회성"),
        status: asText(row.status, "미완료"),
        estimatedMinutes: asNullableNumber(row.estimated_minutes),
        dueDate: asNullableText(row.due_date),
        reminderDate: asNullableText(row.reminder_date),
        scheduleStartTime: row.schedule_start_time
          ? toTimeText(row.schedule_start_time)
          : null,
        scheduleEndTime: row.schedule_end_time
          ? toTimeText(row.schedule_end_time)
          : null,
        color: asNullableText(row.color) ?? undefined,
        ideaGroupId: asNullableText(row.idea_group_id),
        ideaGroupTitle: asNullableText(row.idea_group_title),
        ideaSubcategory: asNullableText(row.idea_subcategory),
        purchaseProductName: asNullableText(row.purchase_product_name),
        purchasePlatform: asNullableText(row.purchase_platform) as
          | "coupang"
          | "other"
          | null,
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as AssistantItem;
    },
  },
  {
    key: STORAGE_KEYS.routineSchedules,
    table: "routine_schedules",
    optionalColumns: [
      "color",
      "place_address",
      "place_postal_code",
      "travel_mode",
      "cancelled_dates",
    ],
    toRow(item, userId, availableColumns) {
      const routine = item as RoutineSchedule;

      const row = {
        id: routine.id,
        user_id: userId,
        title: routine.title,
        day_of_week: routine.dayOfWeek,
        start_time: routine.startTime,
        end_time: routine.endTime,
        place_name: routine.placeName,
        memo: routine.memo,
        start_date: routine.startDate,
        end_date: routine.endDate,
        is_active: routine.isActive,
        created_at: routine.createdAt,
        updated_at: routine.updatedAt,
      };

      return {
        ...row,
        ...(availableColumns.has("color") ? { color: routine.color ?? null } : {}),
        ...(availableColumns.has("place_address")
          ? { place_address: routine.placeAddress ?? "" }
          : {}),
        ...(availableColumns.has("place_postal_code")
          ? { place_postal_code: routine.placePostalCode ?? "" }
          : {}),
        ...(availableColumns.has("travel_mode")
          ? { travel_mode: routine.travelMode ?? null }
          : {}),
        ...(availableColumns.has("cancelled_dates")
          ? { cancelled_dates: routine.cancelledDates ?? [] }
          : {}),
      };
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        title: asText(row.title),
        dayOfWeek: asText(row.day_of_week, "월") as DayOfWeek,
        startTime: toTimeText(row.start_time),
        endTime: toTimeText(row.end_time),
        placeName: asText(row.place_name),
        placeAddress: asText(row.place_address),
        placePostalCode: asText(row.place_postal_code),
        travelMode: asTravelMode(row.travel_mode),
        memo: asText(row.memo),
        color: asNullableText(row.color) ?? undefined,
        cancelledDates: asTextArray(row.cancelled_dates),
        startDate: asNullableText(row.start_date),
        endDate: asNullableText(row.end_date),
        isActive: asBoolean(row.is_active, true),
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as RoutineSchedule;
    },
  },
  {
    key: STORAGE_KEYS.singleSchedules,
    table: "single_schedules",
    optionalColumns: [
      "color",
      "place_address",
      "place_postal_code",
      "travel_mode",
    ],
    toRow(item, userId, availableColumns) {
      const schedule = item as SingleSchedule;

      const row = {
        id: schedule.id,
        user_id: userId,
        source_item_id:
          schedule.sourceItemId && isUuid(schedule.sourceItemId)
            ? schedule.sourceItemId
            : null,
        title: schedule.title,
        date: schedule.date,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        place_name: schedule.placeName,
        memo: schedule.memo,
        created_at: schedule.createdAt,
        updated_at: schedule.updatedAt,
      };

      return {
        ...row,
        ...(availableColumns.has("color")
          ? { color: schedule.color ?? null }
          : {}),
        ...(availableColumns.has("place_address")
          ? { place_address: schedule.placeAddress ?? "" }
          : {}),
        ...(availableColumns.has("place_postal_code")
          ? { place_postal_code: schedule.placePostalCode ?? "" }
          : {}),
        ...(availableColumns.has("travel_mode")
          ? { travel_mode: schedule.travelMode ?? null }
          : {}),
      };
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        sourceItemId: asNullableText(row.source_item_id),
        title: asText(row.title),
        date: asText(row.date),
        startTime: toTimeText(row.start_time),
        endTime: toTimeText(row.end_time),
        placeName: asText(row.place_name),
        placeAddress: asText(row.place_address),
        placePostalCode: asText(row.place_postal_code),
        travelMode: asTravelMode(row.travel_mode),
        memo: asText(row.memo),
        color: asNullableText(row.color) ?? undefined,
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as SingleSchedule;
    },
  },
  {
    key: STORAGE_KEYS.savedPlaces,
    table: "places",
    optionalColumns: [
      "postal_code",
      "place_type",
      "category_name",
      "phone",
      "place_url",
      "business_hours_start",
      "business_hours_end",
      "preferred_visit_start_time",
      "preferred_visit_end_time",
      "typical_stay_minutes",
      "needs_shower_after_visit",
    ],
    toRow(item, userId, availableColumns) {
      const place = item as SavedPlace;

      const row = {
        id: place.id,
        user_id: userId,
        name: place.name,
        address: place.address,
        memo: place.memo,
        provider: place.provider,
        provider_place_id: place.providerPlaceId,
        latitude: place.latitude,
        longitude: place.longitude,
        created_at: place.createdAt,
        updated_at: place.updatedAt,
      };

      if (availableColumns.has("postal_code")) {
        Object.assign(row, {
          postal_code: place.postalCode ?? "",
        });
      }

      if (availableColumns.has("place_type")) {
        Object.assign(row, {
          place_type: place.placeType ?? null,
        });
      }

      if (availableColumns.has("category_name")) {
        Object.assign(row, {
          category_name: place.categoryName ?? null,
        });
      }

      if (availableColumns.has("phone")) {
        Object.assign(row, {
          phone: place.phone ?? null,
        });
      }

      if (availableColumns.has("place_url")) {
        Object.assign(row, {
          place_url: place.placeUrl ?? null,
        });
      }

      if (availableColumns.has("business_hours_start")) {
        Object.assign(row, {
          business_hours_start: place.businessHoursStart ?? null,
        });
      }

      if (availableColumns.has("business_hours_end")) {
        Object.assign(row, {
          business_hours_end: place.businessHoursEnd ?? null,
        });
      }

      if (availableColumns.has("preferred_visit_start_time")) {
        Object.assign(row, {
          preferred_visit_start_time: place.preferredVisitStartTime ?? null,
        });
      }

      if (availableColumns.has("preferred_visit_end_time")) {
        Object.assign(row, {
          preferred_visit_end_time: place.preferredVisitEndTime ?? null,
        });
      }

      if (availableColumns.has("typical_stay_minutes")) {
        Object.assign(row, {
          typical_stay_minutes: place.typicalStayMinutes ?? null,
        });
      }

      if (availableColumns.has("needs_shower_after_visit")) {
        Object.assign(row, {
          needs_shower_after_visit: place.needsShowerAfterVisit ?? null,
        });
      }

      return row;
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        name: asText(row.name),
        address: asText(row.address),
        postalCode: asText(row.postal_code),
        placeType: asNullableText(row.place_type) ?? undefined,
        categoryName: asNullableText(row.category_name) ?? undefined,
        phone: asNullableText(row.phone) ?? undefined,
        placeUrl: asNullableText(row.place_url) ?? undefined,
        businessHoursStart:
          asNullableText(row.business_hours_start) ?? undefined,
        businessHoursEnd: asNullableText(row.business_hours_end) ?? undefined,
        preferredVisitStartTime:
          asNullableText(row.preferred_visit_start_time) ?? undefined,
        preferredVisitEndTime:
          asNullableText(row.preferred_visit_end_time) ?? undefined,
        typicalStayMinutes:
          asNullableNumber(row.typical_stay_minutes) ?? undefined,
        needsShowerAfterVisit:
          typeof row.needs_shower_after_visit === "boolean"
            ? row.needs_shower_after_visit
            : undefined,
        memo: asText(row.memo),
        provider: asNullableText(row.provider),
        providerPlaceId: asNullableText(row.provider_place_id),
        latitude: asNullableNumber(row.latitude),
        longitude: asNullableNumber(row.longitude),
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as SavedPlace;
    },
  },
  {
    key: STORAGE_KEYS.purchaseHistory,
    table: "purchase_history",
    optionalTable: true,
    optionalColumns: [
      "repeat_cycle_days",
      "next_purchase_check_date",
      "source",
      "source_message_id",
      "imported_at",
    ],
    toRow(item, userId, availableColumns) {
      const history = item as PurchaseHistoryItem;

      const row = {
        id: history.id,
        user_id: userId,
        product_name: history.productName,
        platform: history.platform,
        product_url: history.productUrl ?? null,
        default_quantity: history.defaultQuantity ?? null,
        max_budget_krw: history.maxBudgetKrw ?? null,
        auto_repurchase_enabled: history.autoRepurchaseEnabled,
        last_purchased_at: history.lastPurchasedAt,
        memo: history.memo,
        created_at: history.createdAt,
        updated_at: history.updatedAt,
      };

      if (availableColumns.has("repeat_cycle_days")) {
        Object.assign(row, {
          repeat_cycle_days: history.repeatCycleDays ?? null,
        });
      }

      if (availableColumns.has("next_purchase_check_date")) {
        Object.assign(row, {
          next_purchase_check_date: history.nextPurchaseCheckDate ?? null,
        });
      }

      if (availableColumns.has("source")) {
        Object.assign(row, {
          source: history.source ?? "manual",
        });
      }

      if (availableColumns.has("source_message_id")) {
        Object.assign(row, {
          source_message_id: history.sourceMessageId ?? null,
        });
      }

      if (availableColumns.has("imported_at")) {
        Object.assign(row, {
          imported_at: history.importedAt ?? null,
        });
      }

      return row;
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        productName: asText(row.product_name),
        platform: asText(row.platform, "coupang") as PurchaseHistoryItem["platform"],
        productUrl: asNullableText(row.product_url),
        defaultQuantity: asNullableNumber(row.default_quantity),
        maxBudgetKrw: asNullableNumber(row.max_budget_krw),
        repeatCycleDays: asNullableNumber(row.repeat_cycle_days),
        nextPurchaseCheckDate: asNullableText(row.next_purchase_check_date),
        source: asText(row.source, "manual") as PurchaseHistoryItem["source"],
        sourceMessageId: asNullableText(row.source_message_id),
        importedAt: asNullableText(row.imported_at),
        autoRepurchaseEnabled: asBoolean(row.auto_repurchase_enabled, false),
        lastPurchasedAt: asText(row.last_purchased_at),
        memo: asText(row.memo),
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as PurchaseHistoryItem;
    },
  },
  {
    key: STORAGE_KEYS.suggestionFeedback,
    table: "suggestion_feedback",
    toRow(item, userId) {
      const feedback = item as SuggestionFeedback;

      return {
        id: feedback.id,
        user_id: userId,
        item_id: feedback.itemId,
        item_title: feedback.itemTitle,
        suggestion_kind: feedback.suggestionKind,
        suggestion_date: feedback.suggestionDate,
        suggestion_start_time: feedback.suggestionStartTime,
        suggestion_end_time: feedback.suggestionEndTime,
        estimated_minutes: feedback.estimatedMinutes,
        place_name: feedback.placeName,
        feedback_type: feedback.feedbackType,
        note: feedback.note,
        created_at: feedback.createdAt,
        updated_at: feedback.updatedAt,
      };
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        itemId: asText(row.item_id),
        itemTitle: asText(row.item_title),
        suggestionKind: asText(
          row.suggestion_kind,
          "time-task"
        ) as SuggestionFeedback["suggestionKind"],
        suggestionDate: asText(row.suggestion_date),
        suggestionStartTime: toTimeText(row.suggestion_start_time),
        suggestionEndTime: toTimeText(row.suggestion_end_time),
        estimatedMinutes: Number(row.estimated_minutes) || 0,
        placeName: asNullableText(row.place_name),
        feedbackType: asText(
          row.feedback_type,
          "good"
        ) as SuggestionFeedback["feedbackType"],
        note: asText(row.note),
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as SuggestionFeedback;
    },
  },
  {
    key: STORAGE_KEYS.travelTimeRules,
    table: "travel_time_rules",
    toRow(item, userId) {
      const rule = item as TravelTimeRule;

      return {
        id: rule.id,
        user_id: userId,
        from_place_name: rule.fromPlaceName,
        to_place_name: rule.toPlaceName,
        mode: rule.mode,
        minutes: rule.minutes,
        memo: rule.memo,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt,
      };
    },
    fromRow(row) {
      return {
        id: asText(row.id),
        fromPlaceName: asText(row.from_place_name),
        toPlaceName: asText(row.to_place_name),
        mode: asText(row.mode, "transit") as TravelMode,
        minutes: Number(row.minutes) || 0,
        memo: asText(row.memo),
        createdAt: asText(row.created_at),
        updatedAt: asText(row.updated_at),
      } as TravelTimeRule;
    },
  },
];

async function syncDomainWithCloud({
  supabase,
  userId,
  domain,
}: {
  supabase: SupabaseClient;
  userId: string;
  domain: SyncDomain<SyncableItem, { id: string }>;
}) {
  const localItems = readLocalArray<SyncableItem>(domain.key);
  const deletedItemRecords = readDeletedItemRecords(domain.key);
  const deletedIds = new Set(deletedItemRecords.map((record) => record.id));
  const knownRemoteIds = new Set(readKnownRemoteIds(domain.key));
  const remoteDeletedIds = deletedItemRecords
    .map((record) => record.id)
    .filter(isUuid);
  const availableColumns = await getAvailableOptionalColumns({
    supabase,
    table: domain.table,
    optionalColumns: domain.optionalColumns,
  });

  if (remoteDeletedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(domain.table)
      .delete()
      .eq("user_id", userId)
      .in("id", remoteDeletedIds);

    if (deleteError) {
      if (
        domain.optionalTable &&
        (deleteError.code === "42P01" ||
          deleteError.message.includes("does not exist"))
      ) {
        return;
      }

      throw deleteError;
    }
  }

  const { data, error } = await supabase
    .from(domain.table)
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (
      domain.optionalTable &&
      (error.code === "42P01" || error.message.includes("does not exist"))
    ) {
      return;
    }

    throw error;
  }

  const remoteItems = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    domain.fromRow(row)
  );
  const currentRemoteIds = new Set(remoteItems.map((item) => item.id));
  const remotelyDeletedIds = localItems
    .filter((item) => {
      if (currentRemoteIds.has(item.id)) return false;

      return (
        knownRemoteIds.has(item.id) ||
        (isUuid(item.id) && isOlderThanPreviousSuccessfulSync(item))
      );
    })
    .map((item) => item.id);
  const allDeletedIds = new Set([...deletedIds, ...remotelyDeletedIds]);
  const mergedItems = mergeByUpdatedAt(
    localItems.filter((item) => !allDeletedIds.has(item.id)),
    remoteItems.filter((item) => !allDeletedIds.has(item.id))
  );

  if (mergedItems.length > 0) {
    const rows = mergedItems
      .filter((item) => isUuid(item.id))
      .map((item) => domain.toRow(item, userId, availableColumns));

    if (rows.length === 0) {
      writeLocalArraySilently(domain.key, mergedItems);
      return;
    }

    const { error: upsertError } = await supabase
      .from(domain.table)
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }
  }

  writeLocalArraySilently(domain.key, mergedItems);
  writeKnownRemoteIds(
    domain.key,
    mergedItems.filter((item) => isUuid(item.id)).map((item) => item.id)
  );
}

export async function syncLocalDataWithCloud({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const results: CloudSyncDomainResult[] = [];

  for (const domain of syncDomains) {
    try {
      await syncDomainWithCloud({
        supabase,
        userId,
        domain,
      });
      results.push({
        table: domain.table,
        ok: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 동기화 오류";

      console.error(
        `클라우드 데이터 동기화 실패: ${domain.table}`,
        error
      );
      results.push({
        table: domain.table,
        ok: false,
        message,
      });
    }
  }

  return results;
}
