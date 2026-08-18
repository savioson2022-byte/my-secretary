"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadEnabledExternalCalendarEvents,
  onExternalCalendarChanged,
} from "@/lib/externalCalendar";
import { EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT } from "@/lib/externalCalendarSettings";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";

/**
 * 화면에서 외부 캘린더 일정을 읽는 공통 훅.
 *
 * 연동이 꺼져 있거나 권한이 없으면 빈 배열을 준다. 그 경우 계산 함수들은
 * 지금까지와 똑같이 앱 안의 일정만으로 동작한다.
 */
export function useExternalCalendarEvents(startDate: string, endDate: string) {
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);

  const load = useCallback(async () => {
    setEvents(await loadEnabledExternalCalendarEvents({ startDate, endDate }));
  }, [startDate, endDate]);

  useEffect(() => {
    void load();

    // 다른 앱에서 캘린더를 바꾸면 다시 읽는다.
    const removeCalendarListener = onExternalCalendarChanged(() => void load());
    const handleSettingsChanged = () => void load();
    window.addEventListener(
      EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT,
      handleSettingsChanged
    );

    return () => {
      removeCalendarListener();
      window.removeEventListener(
        EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT,
        handleSettingsChanged
      );
    };
  }, [load]);

  return useMemo(() => ({ events, refresh: load }), [events, load]);
}
