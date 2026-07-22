"use client";

import TimeTaskSuggestionView from "@/components/TimeTaskSuggestionView";
import WeeklyAvailabilityView from "@/components/WeeklyAvailabilityView";
import SingleScheduleList from "@/components/SingleScheduleList";
import PlaceKeywordSearch, {
  PlaceSearchResult,
} from "@/components/PlaceKeywordSearch";
import PostcodeAddressSearch from "@/components/PostcodeAddressSearch";
import ScheduleColorPicker from "@/components/ScheduleColorPicker";
import DesktopTimeRangeEditor from "@/components/DesktopTimeRangeEditor";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import {
  getSavedPlaces,
  inferSavedPlaceType,
  saveSavedPlace,
  updateSavedPlace,
} from "@/lib/placeStorage";
import {
  deleteRoutineSchedule,
  getRoutineSchedules,
  saveRoutineSchedule,
  updateRoutineSchedule,
} from "@/lib/routineStorage";
import {
  DEFAULT_ROUTINE_SCHEDULE_COLOR,
  DEFAULT_SINGLE_SCHEDULE_COLOR,
  getScheduleColor,
  getSoftColorStyle,
} from "@/lib/scheduleColors";
import {
  deleteSingleSchedule,
  getSingleScheduleUpdatedEventName,
  getSingleSchedules,
} from "@/lib/singleScheduleStorage";
import { AssistantItem } from "@/types/assistant";
import { SavedPlace, SingleSchedule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, PointerEvent } from "react";

const DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 56;
const MOBILE_HOUR_HEIGHT = 26;
const SNAP_MINUTES = 10;

type DragSelection = {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
};

type RoutineTimeSlot = {
  id: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
};

type RoutineScheduleManagerProps = {
  items: AssistantItem[];
  variant?: "weekly" | "management" | "all";
};

type RoutineGroup = {
  key: string;
  title: string;
  routines: RoutineSchedule[];
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultTimeSlot(): RoutineTimeSlot {
  return {
    id: createId(),
    days: ["월"],
    startTime: "09:00",
    endTime: "10:00",
  };
}

function getTodayText() {
  return toDateText(new Date());
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapMinutes(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRoutineTop(startTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const baseMinutes = START_HOUR * 60;

  return ((startMinutes - baseMinutes) / 60) * HOUR_HEIGHT;
}

function getRoutineHeight(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const rawEndMinutes = timeToMinutes(endTime);
  const endMinutes =
    rawEndMinutes < startMinutes ? rawEndMinutes + 24 * 60 : rawEndMinutes;

  return ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
}

function getScheduleTop(startTime: string, hourHeight: number) {
  const startMinutes = timeToMinutes(startTime);
  const baseMinutes = START_HOUR * 60;

  return ((startMinutes - baseMinutes) / 60) * hourHeight;
}

function getScheduleHeight(
  startTime: string,
  endTime: string,
  hourHeight: number
) {
  const startMinutes = timeToMinutes(startTime);
  const rawEndMinutes = timeToMinutes(endTime);
  const endMinutes =
    rawEndMinutes < startMinutes ? rawEndMinutes + 24 * 60 : rawEndMinutes;

  return ((endMinutes - startMinutes) / 60) * hourHeight;
}

function getMinutesFromMouse(
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
  hourHeight = HOUR_HEIGHT
) {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;

  const minutesFromStart = (y / hourHeight) * 60;
  const rawMinutes = START_HOUR * 60 + minutesFromStart;

  return clamp(snapMinutes(rawMinutes), START_HOUR * 60, END_HOUR * 60);
}

function normalizeSelection(selection: DragSelection) {
  const start = Math.min(selection.startMinutes, selection.endMinutes);
  let end = Math.max(selection.startMinutes, selection.endMinutes);

  if (start === end) {
    end = start + SNAP_MINUTES;
  }

  return {
    day: selection.day,
    startMinutes: start,
    endMinutes: clamp(end, START_HOUR * 60, END_HOUR * 60),
  };
}

function isRoutineEnded(routine: RoutineSchedule) {
  if (!routine.endDate) return false;

  const today = getTodayText();

  return routine.endDate < today;
}

function isRoutineBeforeStart(routine: RoutineSchedule) {
  if (!routine.startDate) return false;

  const today = getTodayText();

  return routine.startDate > today;
}

function isRoutineVisibleInTimetable(routine: RoutineSchedule) {
  if (routine.isActive === false) return false;
  if (isRoutineEnded(routine)) return false;
  if (isRoutineBeforeStart(routine)) return false;

  return true;
}

function getTodayDateOnly() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getStartOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  return addDays(date, diff);
}

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDayOfWeekFromDateText(dateText: string): DayOfWeek {
  const dayIndex = new Date(`${dateText}T00:00:00`).getDay();
  const daysByDateIndex: DayOfWeek[] = ["일", "월", "화", "수", "목", "금", "토"];

  return daysByDateIndex[dayIndex] ?? "월";
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;

  if (routine.startDate && routine.startDate > dateText) {
    return false;
  }

  if (routine.endDate && routine.endDate < dateText) {
    return false;
  }

  if (routine.cancelledDates?.includes(dateText)) {
    return false;
  }

  return true;
}

function getRoutineGroupKey(routine: RoutineSchedule) {
  return routine.title.trim().toLowerCase() || routine.id;
}

function groupRoutinesByTitle(routines: RoutineSchedule[]): RoutineGroup[] {
  const groups = new Map<string, RoutineGroup>();

  routines.forEach((routine) => {
    const key = getRoutineGroupKey(routine);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.routines.push(routine);
      return;
    }

    groups.set(key, {
      key,
      title: routine.title,
      routines: [routine],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      routines: [...group.routines].sort((a, b) => {
        const aValue = `${DAYS.indexOf(a.dayOfWeek)}-${a.startTime}`;
        const bValue = `${DAYS.indexOf(b.dayOfWeek)}-${b.startTime}`;

        return aValue.localeCompare(bValue);
      }),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "ko"));
}

function getTimeSlotsFromRoutines(routines: RoutineSchedule[]): RoutineTimeSlot[] {
  const slots = new Map<string, RoutineTimeSlot>();

  routines.forEach((routine) => {
    const key = `${routine.startTime}-${routine.endTime}`;
    const existingSlot = slots.get(key);

    if (existingSlot) {
      if (!existingSlot.days.includes(routine.dayOfWeek)) {
        existingSlot.days = [...existingSlot.days, routine.dayOfWeek].sort(
          (a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)
        );
      }
      return;
    }

    slots.set(key, {
      id: createId(),
      days: [routine.dayOfWeek],
      startTime: routine.startTime,
      endTime: routine.endTime,
    });
  });

  return Array.from(slots.values()).sort((a, b) => {
    const aValue = `${DAYS.indexOf(a.days[0])}-${a.startTime}`;
    const bValue = `${DAYS.indexOf(b.days[0])}-${b.startTime}`;

    return aValue.localeCompare(bValue);
  });
}

function getCancelledDatesForGroup(group: RoutineGroup) {
  return Array.from(
    new Set(group.routines.flatMap((routine) => routine.cancelledDates ?? []))
  ).sort();
}

function getDateTextsInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dateTexts: string[] = [];

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return dateTexts;
  }

  for (
    let currentDate = start;
    currentDate <= end;
    currentDate = addDays(currentDate, 1)
  ) {
    dateTexts.push(toDateText(currentDate));
  }

  return dateTexts;
}

function RoutineScheduleManager({
  items,
  variant = "all",
}: RoutineScheduleManagerProps) {
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  const [title, setTitle] = useState("");
  const [timeSlots, setTimeSlots] = useState<RoutineTimeSlot[]>(() => [
    createDefaultTimeSlot(),
  ]);
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placePostalCode, setPlacePostalCode] = useState("");
  const [selectedPlaceInfo, setSelectedPlaceInfo] =
    useState<PlaceSearchResult | null>(null);
  const [memo, setMemo] = useState("");
  const [color, setColor] = useState(DEFAULT_ROUTINE_SCHEDULE_COLOR);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingRoutineGroupKey, setEditingRoutineGroupKey] = useState<
    string | null
  >(null);
  const [editRoutineTitle, setEditRoutineTitle] = useState("");
  const [editRoutineTimeSlots, setEditRoutineTimeSlots] = useState<
    RoutineTimeSlot[]
  >(() => [createDefaultTimeSlot()]);
  const [editRoutineStartDate, setEditRoutineStartDate] = useState("");
  const [editRoutineEndDate, setEditRoutineEndDate] = useState("");
  const [editRoutinePlaceName, setEditRoutinePlaceName] = useState("");
  const [editRoutinePlaceAddress, setEditRoutinePlaceAddress] = useState("");
  const [editRoutinePlacePostalCode, setEditRoutinePlacePostalCode] =
    useState("");
  const [editRoutineMemo, setEditRoutineMemo] = useState("");
  const [editRoutineColor, setEditRoutineColor] = useState(
    DEFAULT_ROUTINE_SCHEDULE_COLOR
  );
  const [cancelRangeByGroupKey, setCancelRangeByGroupKey] = useState<
    Record<string, { startDate: string; endDate: string }>
  >({});

  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMobileDateText, setSelectedMobileDateText] = useState(() =>
    getTodayText()
  );
  const [hasSelectedMobileDateManually, setHasSelectedMobileDateManually] =
    useState(false);
  const [isMobileTimelineOpen, setIsMobileTimelineOpen] = useState(false);

  useEffect(() => {
    function refreshSchedules() {
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
      setSavedPlaces(getSavedPlaces());
    }

    refreshSchedules();

    window.addEventListener(
      getSingleScheduleUpdatedEventName(),
      refreshSchedules
    );
    window.addEventListener(getCloudDataSyncedEventName(), refreshSchedules);

    return () => {
      window.removeEventListener(
        getSingleScheduleUpdatedEventName(),
        refreshSchedules
      );
      window.removeEventListener(
        getCloudDataSyncedEventName(),
        refreshSchedules
      );
    };
  }, []);

  const hours = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
      return START_HOUR + index;
    });
  }, []);

  const today = useMemo(() => getTodayDateOnly(), []);

  const weekDates = useMemo(() => {
    const startOfWeek = getStartOfWeekMonday(today);

    return DAYS.map((_, index) => {
      return addDays(startOfWeek, index);
    });
  }, [today]);

  const activeRoutines = useMemo(() => {
    return routines.filter(isRoutineVisibleInTimetable);
  }, [routines]);

  const endedRoutines = useMemo(() => {
    return routines.filter((routine) => {
      return routine.isActive === false || isRoutineEnded(routine);
    });
  }, [routines]);
  const activeRoutineGroups = useMemo(() => {
    return groupRoutinesByTitle(activeRoutines);
  }, [activeRoutines]);
  const endedRoutineGroups = useMemo(() => {
    return groupRoutinesByTitle(endedRoutines);
  }, [endedRoutines]);

  const placeNameOptions = useMemo(() => {
    const names = new Set<string>();

    savedPlaces.forEach((place) => {
      if (place.name.trim()) {
        names.add(place.name.trim());
      }
    });

    routines.forEach((routine) => {
      if (routine.placeName.trim()) {
        names.add(routine.placeName.trim());
      }
    });

    singleSchedules.forEach((schedule) => {
      if (schedule.placeName.trim()) {
        names.add(schedule.placeName.trim());
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
  }, [routines, savedPlaces, singleSchedules]);

  function getSavedPlaceByName(nextPlaceName: string) {
    const normalizedPlaceName = nextPlaceName.trim().toLowerCase();

    return savedPlaces.find((place) => {
      return place.name.trim().toLowerCase() === normalizedPlaceName;
    });
  }

  function handlePlaceNameChange(nextPlaceName: string) {
    setPlaceName(nextPlaceName);
    setSelectedPlaceInfo(null);

    const savedPlace = getSavedPlaceByName(nextPlaceName);

    if (savedPlace) {
      setPlaceAddress(savedPlace.address);
      setPlacePostalCode(savedPlace.postalCode ?? "");
    }
  }

  function handlePlaceSearchSelect(place: PlaceSearchResult) {
    setSelectedPlaceInfo(place);
    setPlaceName(place.name);
    setPlaceAddress(place.address);
    setPlacePostalCode("");
  }

  function saveRoutinePlaceIfNeeded() {
    const trimmedPlaceName = placeName.trim();
    const trimmedAddress = placeAddress.trim();

    if (!trimmedPlaceName || !trimmedAddress) {
      return;
    }

    const now = new Date().toISOString();
    const existingPlace = getSavedPlaceByName(trimmedPlaceName);

    if (existingPlace) {
      updateSavedPlace({
        ...existingPlace,
        name: trimmedPlaceName,
        address: trimmedAddress,
        postalCode: placePostalCode.trim() || undefined,
        placeType:
          selectedPlaceInfo?.placeType ??
          inferSavedPlaceType(trimmedPlaceName, existingPlace.memo),
        categoryName: selectedPlaceInfo?.categoryName ?? existingPlace.categoryName,
        phone: selectedPlaceInfo?.phone ?? existingPlace.phone,
        placeUrl: selectedPlaceInfo?.placeUrl ?? existingPlace.placeUrl,
        businessHoursStart:
          selectedPlaceInfo?.businessHoursStart ??
          existingPlace.businessHoursStart,
        businessHoursEnd:
          selectedPlaceInfo?.businessHoursEnd ?? existingPlace.businessHoursEnd,
        latitude: selectedPlaceInfo?.latitude ?? existingPlace.latitude,
        longitude: selectedPlaceInfo?.longitude ?? existingPlace.longitude,
        provider: selectedPlaceInfo?.provider ?? existingPlace.provider,
        providerPlaceId:
          selectedPlaceInfo?.providerPlaceId ?? existingPlace.providerPlaceId,
        updatedAt: now,
      });
      return;
    }

    saveSavedPlace({
      id: createId(),
      name: trimmedPlaceName,
      address: trimmedAddress,
      postalCode: placePostalCode.trim() || undefined,
      placeType:
        selectedPlaceInfo?.placeType ?? inferSavedPlaceType(trimmedPlaceName),
      categoryName: selectedPlaceInfo?.categoryName,
      phone: selectedPlaceInfo?.phone,
      placeUrl: selectedPlaceInfo?.placeUrl,
      businessHoursStart: selectedPlaceInfo?.businessHoursStart,
      businessHoursEnd: selectedPlaceInfo?.businessHoursEnd,
      memo: "",
      latitude: selectedPlaceInfo?.latitude ?? null,
      longitude: selectedPlaceInfo?.longitude ?? null,
      provider: selectedPlaceInfo?.provider ?? "daum-postcode",
      providerPlaceId: selectedPlaceInfo?.providerPlaceId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  function updateTimeSlot(
    slotId: string,
    nextPartialSlot: Partial<Omit<RoutineTimeSlot, "id">>
  ) {
    setTimeSlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.id !== slotId) return slot;

        return {
          ...slot,
          ...nextPartialSlot,
        };
      })
    );
  }

  function updateEditRoutineTimeSlot(
    slotId: string,
    nextPartialSlot: Partial<Omit<RoutineTimeSlot, "id">>
  ) {
    setEditRoutineTimeSlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.id !== slotId) return slot;

        return {
          ...slot,
          ...nextPartialSlot,
        };
      })
    );
  }

  function toggleTimeSlotDay(slotId: string, day: DayOfWeek) {
    setTimeSlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.id !== slotId) return slot;

        const nextDays = slot.days.includes(day)
          ? slot.days.filter((currentDay) => currentDay !== day)
          : [...slot.days, day];

        return {
          ...slot,
          days: nextDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
        };
      })
    );
  }

  function toggleEditRoutineTimeSlotDay(slotId: string, day: DayOfWeek) {
    setEditRoutineTimeSlots((currentSlots) =>
      currentSlots.map((slot) => {
        if (slot.id !== slotId) return slot;

        const nextDays = slot.days.includes(day)
          ? slot.days.filter((currentDay) => currentDay !== day)
          : [...slot.days, day];

        return {
          ...slot,
          days: nextDays.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
        };
      })
    );
  }

  function addTimeSlot() {
    setTimeSlots((currentSlots) => [
      ...currentSlots,
      {
        ...createDefaultTimeSlot(),
        startTime: currentSlots[currentSlots.length - 1]?.startTime ?? "09:00",
        endTime: currentSlots[currentSlots.length - 1]?.endTime ?? "10:00",
      },
    ]);
  }

  function addEditRoutineTimeSlot() {
    setEditRoutineTimeSlots((currentSlots) => [
      ...currentSlots,
      {
        ...createDefaultTimeSlot(),
        startTime: currentSlots[currentSlots.length - 1]?.startTime ?? "09:00",
        endTime: currentSlots[currentSlots.length - 1]?.endTime ?? "10:00",
      },
    ]);
  }

  function removeTimeSlot(slotId: string) {
    setTimeSlots((currentSlots) => {
      if (currentSlots.length === 1) {
        return currentSlots;
      }

      return currentSlots.filter((slot) => slot.id !== slotId);
    });
  }

  function removeEditRoutineTimeSlot(slotId: string) {
    setEditRoutineTimeSlots((currentSlots) => {
      if (currentSlots.length === 1) {
        return currentSlots;
      }

      return currentSlots.filter((slot) => slot.id !== slotId);
    });
  }

  function applySelectionToFirstTimeSlot(selection: DragSelection) {
    const normalized = normalizeSelection(selection);

    setTimeSlots((currentSlots) => {
      const firstSlot = currentSlots[0] ?? createDefaultTimeSlot();
      const nextFirstSlot: RoutineTimeSlot = {
        ...firstSlot,
        days: [normalized.day],
        startTime: minutesToTime(normalized.startMinutes),
        endTime: minutesToTime(normalized.endMinutes),
      };

      return [nextFirstSlot, ...currentSlots.slice(1)];
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      alert("일정 제목을 입력해줘.");
      return;
    }

    if (!placeName.trim()) {
      alert("위치를 입력해줘.");
      return;
    }

    if (!placeAddress.trim()) {
      alert("우편번호 검색으로 실제 주소를 선택해줘.");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      alert("종료일은 시작일보다 늦거나 같아야 해.");
      return;
    }

    const now = new Date().toISOString();

    const invalidSlot = timeSlots.find((slot) => {
      return slot.days.length === 0 || slot.startTime >= slot.endTime;
    });

    if (invalidSlot) {
      alert("각 시간대마다 요일을 하나 이상 고르고, 종료 시간을 시작 시간보다 늦게 설정해줘.");
      return;
    }

    const newRoutines: RoutineSchedule[] = timeSlots.flatMap((slot) =>
      slot.days.map((selectedDay) => ({
        id: createId(),
        title: title.trim(),
        dayOfWeek: selectedDay,
        startTime: slot.startTime,
        endTime: slot.endTime,
        placeName: placeName.trim(),
        placeAddress: placeAddress.trim(),
        placePostalCode: placePostalCode.trim(),
        memo: memo.trim(),
        color,
        startDate: startDate || null,
        endDate: endDate || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }))
    );

    newRoutines.forEach(saveRoutineSchedule);
    saveRoutinePlaceIfNeeded();
    setRoutines(getRoutineSchedules());
    setSavedPlaces(getSavedPlaces());

    setTitle("");
    setTimeSlots([createDefaultTimeSlot()]);
    setPlaceName("");
    setPlaceAddress("");
    setPlacePostalCode("");
    setSelectedPlaceInfo(null);
    setMemo("");
    setColor(DEFAULT_ROUTINE_SCHEDULE_COLOR);
    setStartDate("");
    setEndDate("");
    setDragSelection(null);
  }

  function handleDelete(id: string) {
    deleteRoutineSchedule(id);
    setRoutines(getRoutineSchedules());
  }

  function handleDeleteSingleSchedule(id: string) {
    deleteSingleSchedule(id);
    setSingleSchedules(getSingleSchedules());
  }

  function startEditRoutineGroup(group: RoutineGroup) {
    const firstRoutine = group.routines[0];
    if (!firstRoutine) return;

    setEditingRoutineGroupKey(group.key);
    setEditRoutineTitle(firstRoutine.title);
    setEditRoutineTimeSlots(getTimeSlotsFromRoutines(group.routines));
    setEditRoutineStartDate(firstRoutine.startDate ?? "");
    setEditRoutineEndDate(firstRoutine.endDate ?? "");
    setEditRoutinePlaceName(firstRoutine.placeName);
    setEditRoutinePlaceAddress(firstRoutine.placeAddress ?? "");
    setEditRoutinePlacePostalCode(firstRoutine.placePostalCode ?? "");
    setEditRoutineMemo(firstRoutine.memo);
    setEditRoutineColor(
      getScheduleColor(firstRoutine.color, DEFAULT_ROUTINE_SCHEDULE_COLOR)
    );
  }

  function cancelEditRoutineGroup() {
    setEditingRoutineGroupKey(null);
    setEditRoutineTitle("");
    setEditRoutineTimeSlots([createDefaultTimeSlot()]);
    setEditRoutineStartDate("");
    setEditRoutineEndDate("");
    setEditRoutinePlaceName("");
    setEditRoutinePlaceAddress("");
    setEditRoutinePlacePostalCode("");
    setEditRoutineMemo("");
    setEditRoutineColor(DEFAULT_ROUTINE_SCHEDULE_COLOR);
  }

  function saveRoutineGroupEdit(group: RoutineGroup) {
    if (!editRoutineTitle.trim()) {
      alert("정기 일정 제목을 입력해줘.");
      return;
    }

    if (!editRoutinePlaceName.trim()) {
      alert("위치를 입력해줘.");
      return;
    }

    if (editRoutineStartDate && editRoutineEndDate && editRoutineStartDate > editRoutineEndDate) {
      alert("종료일은 시작일보다 늦거나 같아야 해.");
      return;
    }

    const invalidSlot = editRoutineTimeSlots.find((slot) => {
      return slot.days.length === 0 || slot.startTime >= slot.endTime;
    });

    if (invalidSlot) {
      alert("각 시간대마다 요일을 하나 이상 고르고, 종료 시간을 시작 시간보다 늦게 설정해줘.");
      return;
    }

    const now = new Date().toISOString();
    const cancelledDates = getCancelledDatesForGroup(group);

    group.routines.forEach((routine) => deleteRoutineSchedule(routine.id));

    editRoutineTimeSlots
      .flatMap((slot) =>
        slot.days.map((selectedDay) => ({
          id: createId(),
          title: editRoutineTitle.trim(),
          dayOfWeek: selectedDay,
          startTime: slot.startTime,
          endTime: slot.endTime,
          placeName: editRoutinePlaceName.trim(),
          placeAddress: editRoutinePlaceAddress.trim() || undefined,
          placePostalCode: editRoutinePlacePostalCode.trim() || undefined,
          memo: editRoutineMemo.trim(),
          color: editRoutineColor,
          cancelledDates: cancelledDates.filter((dateText) => {
            return getDayOfWeekFromDateText(dateText) === selectedDay;
          }),
          startDate: editRoutineStartDate || null,
          endDate: editRoutineEndDate || null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .forEach(saveRoutineSchedule);

    setRoutines(getRoutineSchedules());
    cancelEditRoutineGroup();
  }

  function handleDeleteRoutineGroup(group: RoutineGroup) {
    const shouldDelete = window.confirm(
      `"${group.title}" 정기 일정의 모든 요일/시간대를 삭제할까요?`
    );

    if (!shouldDelete) return;

    group.routines.forEach((routine) => deleteRoutineSchedule(routine.id));
    setRoutines(getRoutineSchedules());

    if (editingRoutineGroupKey === group.key) {
      cancelEditRoutineGroup();
    }
  }

  function cancelRoutineGroupInRange(group: RoutineGroup) {
    const range = cancelRangeByGroupKey[group.key] ?? {
      startDate: getTodayText(),
      endDate: getTodayText(),
    };
    const startDate = range.startDate || getTodayText();
    const endDate = range.endDate || startDate;

    if (startDate > endDate) {
      alert("취소 종료일은 시작일보다 늦거나 같아야 해.");
      return;
    }

    const datesByDay = getDateTextsInRange(startDate, endDate).reduce(
      (result, dateText) => {
        const dayOfWeek = getDayOfWeekFromDateText(dateText);
        const currentDates = result.get(dayOfWeek) ?? [];

        result.set(dayOfWeek, [...currentDates, dateText]);

        return result;
      },
      new Map<DayOfWeek, string[]>()
    );
    let changed = false;

    group.routines.forEach((routine) => {
      const targetDates = datesByDay.get(routine.dayOfWeek) ?? [];
      if (targetDates.length === 0) return;

      const cancelledDates = routine.cancelledDates ?? [];
      const nextCancelledDates = Array.from(
        new Set([...cancelledDates, ...targetDates])
      ).sort();

      if (nextCancelledDates.length === cancelledDates.length) return;

      changed = true;
      updateRoutineSchedule({
        ...routine,
        cancelledDates: nextCancelledDates,
        updatedAt: new Date().toISOString(),
      });
    });

    if (!changed) {
      alert("선택한 기간에 해당하는 반복 일정이 없거나 이미 취소됐습니다.");
    }

    setRoutines(getRoutineSchedules());
  }

  function restoreRoutineGroupDate(group: RoutineGroup, dateText: string) {
    group.routines.forEach((routine) => {
      if (!routine.cancelledDates?.includes(dateText)) return;

      updateRoutineSchedule({
        ...routine,
        cancelledDates: routine.cancelledDates.filter(
          (cancelledDate) => cancelledDate !== dateText
        ),
        updatedAt: new Date().toISOString(),
      });
    });

    setRoutines(getRoutineSchedules());
  }

  function handleRoutineColorChange(routine: RoutineSchedule, nextColor: string) {
    updateRoutineSchedule({
      ...routine,
      color: nextColor,
      updatedAt: new Date().toISOString(),
    });
    setRoutines(getRoutineSchedules());
  }

  function getRoutinesByDayAndDate(day: DayOfWeek, dateText: string) {
    return routines.filter((routine) => {
      return (
        routine.dayOfWeek === day && isRoutineActiveOnDate(routine, dateText)
      );
    });
  }

  function getSingleSchedulesByDateText(dateText: string) {
    return singleSchedules.filter((schedule) => schedule.date === dateText);
  }

  function getDailyScheduleItems(day: DayOfWeek, dateText: string) {
    const routineItems = getRoutinesByDayAndDate(day, dateText).map(
      (routine) => {
        const scheduleColor = getScheduleColor(
          routine.color,
          DEFAULT_ROUTINE_SCHEDULE_COLOR
        );

        return {
          id: `routine-${routine.id}-${dateText}`,
          type: "정기",
          title: routine.title,
          placeName: routine.placeName,
          startTime: routine.startTime,
          endTime: routine.endTime,
          color: scheduleColor,
        };
      }
    );
    const singleItems = getSingleSchedulesByDateText(dateText).map(
      (schedule) => {
        const scheduleColor = getScheduleColor(
          schedule.color,
          DEFAULT_SINGLE_SCHEDULE_COLOR
        );

        return {
          id: `single-${schedule.id}`,
          type: "단기",
          title: schedule.title,
          placeName: schedule.placeName || "위치 미입력",
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          color: scheduleColor,
        };
      }
    );

    return [...routineItems, ...singleItems].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>,
    day: DayOfWeek
  ) {
    if (!canEditCalendar || !isEditMode) return;

    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragSelection({
      day,
      startMinutes: selectedMinutes,
      endMinutes: selectedMinutes + SNAP_MINUTES,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragSelection) return;

    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    setDragSelection({
      ...dragSelection,
      endMinutes: selectedMinutes,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragSelection) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    const normalized = normalizeSelection(dragSelection);

    setIsDragging(false);
    setDragSelection(normalized);

    applySelectionToFirstTimeSlot(normalized);
  }

  function handleMobilePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canEditCalendar || !isEditMode) return;

    const selectedMinutes = getMinutesFromMouse(
      event,
      event.currentTarget,
      MOBILE_HOUR_HEIGHT
    );

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragSelection({
      day: selectedMobileDay,
      startMinutes: selectedMinutes,
      endMinutes: selectedMinutes + SNAP_MINUTES,
    });
  }

  function handleMobilePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragSelection) return;

    const selectedMinutes = getMinutesFromMouse(
      event,
      event.currentTarget,
      MOBILE_HOUR_HEIGHT
    );

    setDragSelection({
      ...dragSelection,
      endMinutes: selectedMinutes,
    });
  }

  function handleMobilePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragSelection) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    const normalized = normalizeSelection(dragSelection);

    setIsDragging(false);
    setDragSelection(normalized);

    applySelectionToFirstTimeSlot(normalized);
  }

  const normalizedDragSelection = dragSelection
    ? normalizeSelection(dragSelection)
    : null;
  const selectedMobileIndex = Math.max(
    0,
    weekDates.findIndex((date) => toDateText(date) === selectedMobileDateText)
  );
  const selectedMobileDate = weekDates[selectedMobileIndex] ?? weekDates[0];
  const selectedMobileDay = DAYS[selectedMobileIndex] ?? DAYS[0];
  const selectedMobileItems = getDailyScheduleItems(
    selectedMobileDay,
    toDateText(selectedMobileDate)
  );
  const selectedMobileTimelineRange = useMemo(() => {
    if (selectedMobileItems.length === 0) {
      return {
        startHour: 8,
        endHour: 22,
      };
    }

    const firstStartMinutes = Math.min(
      ...selectedMobileItems.map((item) => timeToMinutes(item.startTime))
    );
    const lastEndMinutes = Math.max(
      ...selectedMobileItems.map((item) => {
        const startMinutes = timeToMinutes(item.startTime);
        const endMinutes = timeToMinutes(item.endTime);
        return endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
      })
    );
    const startHour = clamp(
      Math.floor(firstStartMinutes / 60) - 1,
      START_HOUR,
      END_HOUR - 1
    );
    const endHour = clamp(
      Math.ceil(lastEndMinutes / 60) + 1,
      startHour + 1,
      END_HOUR
    );

    return {
      startHour,
      endHour,
    };
  }, [selectedMobileItems]);
  const weeklyMobileSummaries = useMemo(() => {
    return DAYS.map((day, index) => {
      const date = weekDates[index];
      const dateText = toDateText(date);
      const itemsForDate = getDailyScheduleItems(day, dateText);

      return {
        day,
        date,
        dateText,
        items: itemsForDate,
      };
    });
  }, [routines, singleSchedules, weekDates]);
  const weeklyMobileItems = weeklyMobileSummaries.flatMap((summary) =>
    summary.items.map((item) => ({
      ...item,
      day: summary.day,
      dateText: summary.dateText,
      date: summary.date,
    }))
  );
  const showWeeklyCalendar = variant !== "management";
  const canEditCalendar = variant !== "weekly";
  const showAvailabilityAndSuggestions = variant !== "management";
  const showScheduleManagement = variant !== "weekly";

  useEffect(() => {
    if (hasSelectedMobileDateManually) return;

    const currentSummary = weeklyMobileSummaries.find((summary) => {
      return summary.dateText === selectedMobileDateText;
    });

    if (currentSummary && currentSummary.items.length > 0) {
      return;
    }

    const nextSummaryWithItems = weeklyMobileSummaries.find((summary) => {
      return summary.items.length > 0;
    });

    if (nextSummaryWithItems) {
      setSelectedMobileDateText(nextSummaryWithItems.dateText);
    }
  }, [
    hasSelectedMobileDateManually,
    selectedMobileDateText,
    weeklyMobileSummaries,
  ]);

  return (
    <section className="space-y-6">
      {showWeeklyCalendar && (
      <>
      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">주간 캘린더</h2>
            <p className="mt-1 text-sm text-slate-500">
              {canEditCalendar
                ? "편집을 켜면 시간대를 10분 단위로 드래그해 정기 일정 입력에 반영할 수 있습니다."
                : "오늘과 이번 주 일정을 빠르게 확인하는 보기 전용 시간표입니다."}
            </p>
          </div>
          {canEditCalendar && (
          <button
            type="button"
            onClick={() => setIsEditMode((current) => !current)}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              isEditMode
                ? "bg-slate-950 text-white"
                : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
            }`}
          >
            {isEditMode ? "편집 종료" : "주간 캘린더 편집"}
          </button>
          )}
        </div>

        <div className="mt-4 md:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DAYS.map((day, index) => {
              const date = weekDates[index];
              const dateText = toDateText(date);
              const dayItems = getDailyScheduleItems(day, dateText);
              const isToday = dateText === toDateText(today);
              const isSelected = dateText === toDateText(selectedMobileDate);
              const densityLabel =
                dayItems.length >= 4
                  ? "바쁨"
                  : dayItems.length >= 2
                  ? "보통"
                  : dayItems.length === 1
                  ? "여유"
                  : "비어있음";

              return (
                <button
                  key={dateText}
                  type="button"
                  onClick={() => {
                    setSelectedMobileDateText(dateText);
                    setHasSelectedMobileDateManually(true);
                  }}
                  className={`min-w-[78px] rounded-3xl px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-100"
                  }`}
                >
                  <p className="text-xs font-black opacity-80">
                    {formatMonthDay(date)}
                  </p>
                  <p className="mt-1 text-xl font-black">{day}</p>
                  <p className="mt-2 text-[11px] font-bold opacity-75">
                    {isToday ? "오늘 · " : ""}
                    {densityLabel}
                  </p>
                  <div className="mt-2 flex gap-1">
                    {dayItems.slice(0, 4).map((item) => (
                      <span
                        key={`${dateText}-${item.id}`}
                        className="h-1.5 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {weeklyMobileItems.length > 0 && (
            <div className="mt-4 rounded-[28px] bg-white p-4 ring-1 ring-slate-100">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900">
                  이번 주 일정
                </h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  {weeklyMobileItems.length}개
                </span>
              </div>
              <div className="space-y-2">
                {weeklyMobileItems.slice(0, 6).map((item) => (
                  <button
                    key={`${item.dateText}-${item.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedMobileDateText(item.dateText);
                      setHasSelectedMobileDateManually(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-100"
                  >
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                        {formatMonthDay(item.date)} {item.day}요일 ·{" "}
                        {item.startTime} ~ {item.endTime}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[28px] bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-500">
                  {formatMonthDay(selectedMobileDate)} {selectedMobileDay}요일
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  하루 일정
                </h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                {selectedMobileItems.length}개
              </span>
            </div>

            {selectedMobileItems.length === 0 ? (
              <div className="mt-4 rounded-3xl bg-white p-5 text-center text-sm font-bold leading-6 text-slate-400 ring-1 ring-slate-100">
                선택한 요일에는 아직 표시할 일정이 없습니다.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedMobileItems.map((item) => {
                  const scheduleColor = getScheduleColor(
                    item.color,
                    item.type === "정기"
                      ? DEFAULT_ROUTINE_SCHEDULE_COLOR
                      : DEFAULT_SINGLE_SCHEDULE_COLOR
                  );

                  return (
                    <article
                      key={`mobile-card-${item.id}`}
                      className="flex gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-100"
                    >
                      <span
                        className="w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: scheduleColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-black tracking-tight text-slate-950">
                              {item.title}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                              {item.placeName}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black"
                            style={getSoftColorStyle(scheduleColor)}
                          >
                            {item.type}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">
                            {item.startTime}
                          </span>
                          <span className="text-xs font-black text-slate-300">
                            -
                          </span>
                          <span className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                            {item.endTime}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
                  <div className="mb-3 flex items-center justify-between text-xs font-black text-slate-400">
                    <span>
                      {String(selectedMobileTimelineRange.startHour).padStart(
                        2,
                        "0"
                      )}
                      :00
                    </span>
                    <span>
                      {String(selectedMobileTimelineRange.endHour).padStart(
                        2,
                        "0"
                      )}
                      :00
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-slate-100">
                    {selectedMobileItems.map((item) => {
                      const rangeStartMinutes =
                        selectedMobileTimelineRange.startHour * 60;
                      const rangeEndMinutes =
                        selectedMobileTimelineRange.endHour * 60;
                      const rangeMinutes =
                        rangeEndMinutes - rangeStartMinutes || 1;
                      const itemStartMinutes = timeToMinutes(item.startTime);
                      const rawItemEndMinutes = timeToMinutes(item.endTime);
                      const itemEndMinutes =
                        rawItemEndMinutes < itemStartMinutes
                          ? rawItemEndMinutes + 24 * 60
                          : rawItemEndMinutes;
                      const left =
                        ((itemStartMinutes - rangeStartMinutes) /
                          rangeMinutes) *
                        100;
                      const width =
                        ((itemEndMinutes - itemStartMinutes) / rangeMinutes) *
                        100;

                      return (
                        <span
                          key={`mobile-mini-${item.id}`}
                          className="absolute top-0 h-3 rounded-full"
                          style={{
                            left: `${Math.max(0, left)}%`,
                            width: `${Math.max(4, width)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsMobileTimelineOpen((current) => !current)}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-100 transition hover:bg-slate-50"
            >
              {isMobileTimelineOpen ? "시간표 접기" : "24시간 시간표 보기"}
            </button>

            {isMobileTimelineOpen && (
              <div
              onPointerDown={handleMobilePointerDown}
              onPointerMove={handleMobilePointerMove}
              onPointerUp={handleMobilePointerUp}
              onPointerCancel={() => {
                if (isDragging) {
                  setIsDragging(false);
                }
              }}
              className={`relative mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-100 ${
                canEditCalendar && isEditMode ? "touch-none" : ""
              }`}
              style={{
                height: `${(END_HOUR - START_HOUR) * MOBILE_HOUR_HEIGHT}px`,
              }}
              >
              <div className="absolute inset-y-0 left-0 w-14 border-r border-slate-100 bg-slate-50">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100 pr-2 text-right text-[10px] font-bold text-slate-400"
                    style={{ height: `${MOBILE_HOUR_HEIGHT}px` }}
                  >
                    <span className="relative top-[-2px]">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              <div className="absolute inset-y-0 left-14 right-0">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100"
                    style={{ height: `${MOBILE_HOUR_HEIGHT}px` }}
                  />
                ))}

                {normalizedDragSelection &&
                  normalizedDragSelection.day === selectedMobileDay && (
                    <div
                      className="pointer-events-none absolute left-2 right-2 z-10 rounded-2xl border border-blue-400 bg-blue-200/70 p-2 text-xs"
                      style={{
                        top: `${
                          ((normalizedDragSelection.startMinutes -
                            START_HOUR * 60) /
                            60) *
                          MOBILE_HOUR_HEIGHT
                        }px`,
                        height: `${Math.max(
                          ((normalizedDragSelection.endMinutes -
                            normalizedDragSelection.startMinutes) /
                            60) *
                            MOBILE_HOUR_HEIGHT,
                          24
                        )}px`,
                      }}
                    >
                      <p className="font-black text-blue-950">선택한 시간</p>
                      <p className="mt-0.5 font-semibold text-blue-800">
                        {minutesToTime(normalizedDragSelection.startMinutes)} ~{" "}
                        {minutesToTime(normalizedDragSelection.endMinutes)}
                      </p>
                    </div>
                  )}

                {selectedMobileItems.map((item) => {
                  const top = getScheduleTop(
                    item.startTime,
                    MOBILE_HOUR_HEIGHT
                  );
                  const height = getScheduleHeight(
                    item.startTime,
                    item.endTime,
                    MOBILE_HOUR_HEIGHT
                  );

                  return (
                    <div
                      key={item.id}
                      className="absolute left-2 right-2 overflow-hidden rounded-2xl border p-3 text-xs"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 28)}px`,
                        ...getSoftColorStyle(item.color),
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                          {item.type}
                        </span>
                        <p className="truncate font-black">{item.title}</p>
                      </div>
                      <p className="mt-1 truncate font-semibold">
                        {item.startTime} ~ {item.endTime}
                      </p>
                      <p className="mt-0.5 truncate">{item.placeName}</p>
                    </div>
                  );
                })}

                {selectedMobileItems.length === 0 && (
                  <div className="absolute inset-x-4 top-16 rounded-3xl bg-slate-50 p-4 text-center text-sm font-bold leading-6 text-slate-400 ring-1 ring-slate-100">
                    선택한 요일에는 아직 표시할 일정이 없습니다.
                  </div>
                )}
              </div>
              </div>
            )}

            {isMobileTimelineOpen && canEditCalendar && isEditMode && (
              <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700 ring-1 ring-blue-100">
                하루 시간표를 누르고 드래그하면 10분 단위로 시간이 선택되고,
                아래 정기 일정 입력칸에 자동 반영됩니다.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 hidden max-h-[720px] overflow-auto rounded-3xl border border-slate-100 bg-slate-50 md:block">
          <div className="min-w-[760px] md:min-w-[860px]">
            <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 bg-white">
              <div className="p-3 text-center text-xs font-bold text-slate-400">
                시간
              </div>

              {DAYS.map((day, index) => {
                const date = weekDates[index];
                const dateText = toDateText(date);
                const isToday = dateText === toDateText(today);

                return (
                  <div
                    key={day}
                    className="border-l border-slate-100 p-3 text-center text-sm font-black text-slate-700"
                  >
                    <p>
                      {formatMonthDay(date)} {day}
                    </p>

                    {isToday && (
                      <p className="mt-1 text-xs font-bold text-emerald-600">
                        오늘
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="relative grid select-none grid-cols-[64px_repeat(7,1fr)]"
              style={{
                height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`,
              }}
            >
              <div className="relative bg-white">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100 pr-2 text-right text-xs font-semibold text-slate-400"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    <span className="relative top-[-2px]">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {DAYS.map((day, index) => {
                const date = weekDates[index];
                const dateText = toDateText(date);

                const routinesForDate = getRoutinesByDayAndDate(day, dateText);
                const singleSchedulesForDate =
                  getSingleSchedulesByDateText(dateText);

                return (
                  <div
                    key={day}
                    onPointerDown={(event) => handlePointerDown(event, day)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={() => {
                      if (isDragging) {
                        setIsDragging(false);
                      }
                    }}
                    className={`relative border-l border-slate-100 bg-white ${
                      canEditCalendar && isEditMode ? "cursor-crosshair touch-none" : "cursor-default"
                    }`}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-slate-100 hover:bg-emerald-50/40"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {normalizedDragSelection &&
                      normalizedDragSelection.day === day && (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-10 rounded-2xl border border-blue-400 bg-blue-200/60 p-2 text-xs"
                          style={{
                            top: `${
                              ((normalizedDragSelection.startMinutes -
                                START_HOUR * 60) /
                                60) *
                              HOUR_HEIGHT
                            }px`,
                            height: `${Math.max(
                              ((normalizedDragSelection.endMinutes -
                                normalizedDragSelection.startMinutes) /
                                60) *
                                HOUR_HEIGHT,
                              28
                            )}px`,
                          }}
                        >
                          <p className="font-black text-blue-950">
                            선택한 시간
                          </p>
                          <p className="mt-0.5 font-semibold text-blue-800">
                            {minutesToTime(
                              normalizedDragSelection.startMinutes
                            )}{" "}
                            ~ {minutesToTime(normalizedDragSelection.endMinutes)}
                          </p>
                        </div>
                      )}

                    {routinesForDate.map((routine) => {
                      const top = getRoutineTop(routine.startTime);
                      const height = getRoutineHeight(
                        routine.startTime,
                        routine.endTime
                      );
                      const scheduleColor = getScheduleColor(
                        routine.color,
                        DEFAULT_ROUTINE_SCHEDULE_COLOR
                      );

                      return (
                        <div
                          key={`routine-${routine.id}-${dateText}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl border p-2 text-xs"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                            ...getSoftColorStyle(scheduleColor),
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                              정기
                            </span>
                            <p className="truncate font-black">
                              {routine.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold">
                            {routine.startTime} ~ {routine.endTime}
                          </p>
                          <p className="mt-0.5 truncate">
                            {routine.placeName}
                          </p>
                        </div>
                      );
                    })}

                    {singleSchedulesForDate.map((schedule) => {
                      const top = getRoutineTop(schedule.startTime);
                      const height = getRoutineHeight(
                        schedule.startTime,
                        schedule.endTime
                      );
                      const scheduleColor = getScheduleColor(
                        schedule.color,
                        DEFAULT_SINGLE_SCHEDULE_COLOR
                      );

                      return (
                        <div
                          key={`single-${schedule.id}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl border p-2 text-xs"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                            ...getSoftColorStyle(scheduleColor),
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                              단기
                            </span>
                            <p className="truncate font-black">
                              {schedule.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold">
                            {schedule.startTime} ~ {schedule.endTime}
                          </p>
                          <p className="mt-0.5 truncate">
                            {schedule.placeName || "위치 미입력"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {showAvailabilityAndSuggestions && (
      <>
        <WeeklyAvailabilityView
          routines={routines}
          singleSchedules={singleSchedules}
        />

        <TimeTaskSuggestionView
          items={items}
          routines={routines}
          singleSchedules={singleSchedules}
        />
      </>
      )}
      </>
      )}

      {showScheduleManagement && (
      <>
      <section
        id="schedule-manager"
        className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100"
      >
        <div>
          <h2 className="text-lg font-black text-slate-900">나의 일정 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            정기 일정은 새로 입력하고, 단기 일정은 아래 목록에서 수정합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700">
              일정 제목
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 학교, 영어학원, 수영 연습"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="text-sm font-bold text-slate-700">
                  요일 및 시간
                </label>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                  제목, 장소, 기간은 한 번만 쓰고 시간대만 여러 줄로 추가할 수
                  있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={addTimeSlot}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white transition hover:bg-slate-700"
                aria-label="요일 및 시간 추가"
                title="요일 및 시간 추가"
              >
                +
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className="rounded-3xl bg-white p-3 ring-1 ring-slate-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-slate-500">
                      시간대 {index + 1}
                    </p>
                    {timeSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(slot.id)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1">
                    {DAYS.map((day) => {
                      const isSelected = slot.days.includes(day);

                      return (
                        <button
                          key={`${slot.id}-${day}`}
                          type="button"
                          onClick={() => toggleTimeSlotDay(slot.id, day)}
                          className={`rounded-2xl px-2 py-3 text-sm font-black transition ${
                            isSelected
                              ? "bg-slate-950 text-white"
                              : "bg-white text-slate-500 ring-1 ring-slate-200"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-500">
                        시작
                      </label>
                      <input
                        type="time"
                        step={600}
                        value={slot.startTime}
                        onChange={(event) =>
                          updateTimeSlot(slot.id, {
                            startTime: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-500">
                        종료
                      </label>
                      <input
                        type="time"
                        step={600}
                        value={slot.endTime}
                        onChange={(event) =>
                          updateTimeSlot(slot.id, {
                            endTime: event.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <DesktopTimeRangeEditor
                      startTime={slot.startTime}
                      endTime={slot.endTime}
                      onChange={(nextValue) =>
                        updateTimeSlot(slot.id, nextValue)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ScheduleColorPicker
            label="캘린더 색인"
            value={color}
            onChange={setColor}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <label className="text-sm font-bold text-slate-700">
                  위치와 실제 주소
                </label>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  우편번호 검색으로 도로명 주소를 선택하면 이동시간 계산에
                  사용할 장소로 함께 저장됩니다.
                </p>
              </div>
              <div className="w-full md:w-44">
                <PostcodeAddressSearch
                  onSelect={({ address, postalCode, detailHint }) => {
                    setPlaceAddress(address);
                    setPlacePostalCode(postalCode);
                    setSelectedPlaceInfo(null);

                    if (!placeName.trim() && detailHint) {
                      setPlaceName(detailHint.split(",")[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <div>
                <input
                  list="routine-place-options"
                  value={placeName}
                  onChange={(event) =>
                    handlePlaceNameChange(event.target.value)
                  }
                  placeholder="장소 이름: 집, 학교, 영어학원"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
                <datalist id="routine-place-options">
                  {placeNameOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <input
                value={placeAddress}
                onChange={(event) => setPlaceAddress(event.target.value)}
                placeholder="우편번호 검색 후 도로명 주소가 들어옵니다"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mt-3">
              <PlaceKeywordSearch
                defaultQuery={placeName}
                onSelect={handlePlaceSearchSelect}
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
              <input
                value={placePostalCode}
                onChange={(event) => setPlacePostalCode(event.target.value)}
                placeholder="우편번호"
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
              <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-500 ring-1 ring-slate-100">
                기존 저장 장소를 선택하면 주소가 자동으로 채워집니다. 새 장소는
                정기 일정 저장 시 저장 장소 목록에도 추가됩니다.
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">메모</label>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="예: 3월 2일부터 6월 5일까지"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            정기 일정 저장
          </button>
        </form>

      </section>

      <SingleScheduleList
        schedules={singleSchedules}
        onDelete={handleDeleteSingleSchedule}
        onChange={() => {
          setSingleSchedules(getSingleSchedules());
          setSavedPlaces(getSavedPlaces());
        }}
      />

      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">
              정기 일정 묶음
            </h3>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
              같은 제목의 정기 일정을 한 묶음으로 관리합니다. 전체 삭제와 특정
              날짜만 취소는 서로 다른 작업입니다.
            </p>
          </div>

          {activeRoutineGroups.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              현재 활성화된 정기 일정이 없습니다.
            </p>
          ) : (
            activeRoutineGroups.map((group) => {
              const firstRoutine = group.routines[0];
              const isEditingGroup = editingRoutineGroupKey === group.key;
              const cancelledDates = getCancelledDatesForGroup(group);

              if (!firstRoutine) return null;

              return (
                <div
                  key={group.key}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  {isEditingGroup ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={editRoutineTitle}
                          onChange={(event) =>
                            setEditRoutineTitle(event.target.value)
                          }
                          placeholder="일정 제목"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                        <input
                          value={editRoutinePlaceName}
                          onChange={(event) =>
                            setEditRoutinePlaceName(event.target.value)
                          }
                          placeholder="장소 이름"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={editRoutinePlaceAddress}
                          onChange={(event) =>
                            setEditRoutinePlaceAddress(event.target.value)
                          }
                          placeholder="주소"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                        <input
                          value={editRoutinePlacePostalCode}
                          onChange={(event) =>
                            setEditRoutinePlacePostalCode(event.target.value)
                          }
                          placeholder="우편번호"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          type="date"
                          value={editRoutineStartDate}
                          onChange={(event) =>
                            setEditRoutineStartDate(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                        <input
                          type="date"
                          value={editRoutineEndDate}
                          onChange={(event) =>
                            setEditRoutineEndDate(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black text-slate-500">
                            요일 및 시간대
                          </p>
                          <button
                            type="button"
                            onClick={addEditRoutineTimeSlot}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                          >
                            시간대 추가
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          {editRoutineTimeSlots.map((slot, index) => (
                            <div
                              key={slot.id}
                              className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-black text-slate-500">
                                  시간대 {index + 1}
                                </p>
                                {editRoutineTimeSlots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeEditRoutineTimeSlot(slot.id)
                                    }
                                    className="rounded-full bg-white px-3 py-1 text-xs font-black text-rose-500 ring-1 ring-rose-100"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-7 gap-1">
                                {DAYS.map((day) => {
                                  const isSelected = slot.days.includes(day);

                                  return (
                                    <button
                                      key={`${slot.id}-${day}`}
                                      type="button"
                                      onClick={() =>
                                        toggleEditRoutineTimeSlotDay(
                                          slot.id,
                                          day
                                        )
                                      }
                                      className={`rounded-2xl px-2 py-3 text-sm font-black transition ${
                                        isSelected
                                          ? "bg-slate-950 text-white"
                                          : "bg-white text-slate-500 ring-1 ring-slate-200"
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <input
                                  type="time"
                                  step={600}
                                  value={slot.startTime}
                                  onChange={(event) =>
                                    updateEditRoutineTimeSlot(slot.id, {
                                      startTime: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                                />
                                <input
                                  type="time"
                                  step={600}
                                  value={slot.endTime}
                                  onChange={(event) =>
                                    updateEditRoutineTimeSlot(slot.id, {
                                      endTime: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                                />
                              </div>
                              <div className="mt-3">
                                <DesktopTimeRangeEditor
                                  startTime={slot.startTime}
                                  endTime={slot.endTime}
                                  onChange={(nextValue) =>
                                    updateEditRoutineTimeSlot(slot.id, nextValue)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <input
                        value={editRoutineMemo}
                        onChange={(event) =>
                          setEditRoutineMemo(event.target.value)
                        }
                        placeholder="메모"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />

                      <ScheduleColorPicker
                        label="캘린더 색인"
                        value={editRoutineColor}
                        onChange={setEditRoutineColor}
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveRoutineGroupEdit(group)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
                        >
                          묶음 저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditRoutineGroup}
                          className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          편집 취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoutineGroup(group)}
                          className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                        >
                          이 정기 일정 전체 삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">
                            {group.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            위치: {firstRoutine.placeName || "위치 미입력"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            기간: {firstRoutine.startDate ?? "제한 없음"} ~{" "}
                            {firstRoutine.endDate ?? "제한 없음"}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => startEditRoutineGroup(group)}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                          >
                            묶음 편집
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoutineGroup(group)}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                          >
                            전체 삭제
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {getTimeSlotsFromRoutines(group.routines).map((slot) => (
                          <div
                            key={`${group.key}-${slot.startTime}-${slot.endTime}`}
                            className="rounded-2xl bg-white p-3 text-sm font-bold text-slate-600 ring-1 ring-slate-100"
                          >
                            <p className="text-slate-900">
                              {slot.days.join(", ")}요일
                            </p>
                            <p className="mt-1">
                              {slot.startTime} ~ {slot.endTime}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-100">
                        <p className="text-xs font-black text-slate-500">
                          특정 기간만 취소
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            type="date"
                            value={
                              cancelRangeByGroupKey[group.key]?.startDate ??
                              getTodayText()
                            }
                            onChange={(event) =>
                              setCancelRangeByGroupKey((current) => ({
                                ...current,
                                [group.key]: {
                                  startDate: event.target.value,
                                  endDate:
                                    current[group.key]?.endDate ??
                                    event.target.value,
                                },
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                          />
                          <input
                            type="date"
                            value={
                              cancelRangeByGroupKey[group.key]?.endDate ??
                              cancelRangeByGroupKey[group.key]?.startDate ??
                              getTodayText()
                            }
                            onChange={(event) =>
                              setCancelRangeByGroupKey((current) => ({
                                ...current,
                                [group.key]: {
                                  startDate:
                                    current[group.key]?.startDate ??
                                    getTodayText(),
                                  endDate: event.target.value,
                                },
                              }))
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={() => cancelRoutineGroupInRange(group)}
                            className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 ring-1 ring-amber-100"
                          >
                            기간 취소
                          </button>
                        </div>

                        {cancelledDates.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {cancelledDates.map((dateText) => (
                              <button
                                key={`${group.key}-${dateText}`}
                                type="button"
                                onClick={() =>
                                  restoreRoutineGroupDate(group, dateText)
                                }
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                {dateText} 취소됨 · 복구
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {endedRoutineGroups.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-black text-slate-800">
              종료된 정기 일정 묶음
            </h3>

            {endedRoutineGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-2xl border border-slate-100 bg-slate-100 p-4 opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-700">{group.title}</p>
                    <div className="mt-2 space-y-1">
                      {getTimeSlotsFromRoutines(group.routines).map((slot) => (
                        <p
                          key={`${group.key}-ended-${slot.startTime}-${slot.endTime}`}
                          className="text-sm text-slate-500"
                        >
                          {slot.days.join(", ")}요일 {slot.startTime} ~{" "}
                          {slot.endTime}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRoutineGroup(group)}
                    className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                  >
                    전체 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </section>
  );
}

export default RoutineScheduleManager;
