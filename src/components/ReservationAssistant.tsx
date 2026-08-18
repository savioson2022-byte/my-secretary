"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateFreeTimeBlocksForDate, minutesToTime, timeToMinutes } from "@/lib/availability";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { getSavedPlaces, saveSavedPlace } from "@/lib/placeStorage";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { getSingleSchedules, saveSingleSchedule } from "@/lib/singleScheduleStorage";
import { updateItem } from "@/lib/storage";
import { useExternalCalendarEvents } from "@/lib/useExternalCalendarEvents";
import { getUserProfile } from "@/lib/userProfileStorage";
import type { AssistantItem } from "@/types/assistant";
import type { SavedPlace, SingleSchedule } from "@/types/calendar";
import type { RoutineSchedule } from "@/types/routine";

type SearchPlace = {
  provider: "kakao" | "naver";
  providerPlaceId: string | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  categoryName: string;
  phone: string;
  placeUrl: string;
  placeType: SavedPlace["placeType"];
  businessHoursStart?: string;
  businessHoursEnd?: string;
};

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function tomorrowText() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cleanReservationQuery(item?: AssistantItem) {
  return (item?.placeName || item?.title || item?.originalText || "")
    .replace(/네이버|예약해줘|예약|해줘|잡아줘|방문/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function naverPlaceUrl(place: SearchPlace) {
  const query = encodeURIComponent(`${place.name} ${place.address}`.trim());
  return `https://m.place.naver.com/place/list?query=${query}`;
}

export default function ReservationAssistant({ items }: { items: AssistantItem[] }) {
  const reservationItems = items.filter((item) => item.status === "미완료" && item.actionType === "예약");
  const [selectedItemId, setSelectedItemId] = useState(reservationItems[0]?.id ?? "new");
  const selectedItem = reservationItems.find((item) => item.id === selectedItemId);
  const [query, setQuery] = useState(cleanReservationQuery(selectedItem));
  const [places, setPlaces] = useState<SearchPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null);
  const [date, setDate] = useState(selectedItem?.dueDate ?? tomorrowText());
  const [startTime, setStartTime] = useState(selectedItem?.scheduleStartTime ?? "10:00");
  const [duration, setDuration] = useState("60");
  const [people, setPeople] = useState("1");
  const [requestMemo, setRequestMemo] = useState("");
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [openedExternal, setOpenedExternal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
      const preferred = getUserProfile()?.reservationPreferredStartTime;
      if (preferred) setStartTime((current) => current || preferred);
    };
    refresh();
    window.addEventListener(getLocalDataUpdatedEventName(), refresh);
    return () => window.removeEventListener(getLocalDataUpdatedEventName(), refresh);
  }, []);

  useEffect(() => {
    const item = reservationItems.find((candidate) => candidate.id === selectedItemId);
    if (selectedItemId === "new") return;
    setQuery(cleanReservationQuery(item));
    setDate(item?.dueDate ?? tomorrowText());
    setStartTime(item?.scheduleStartTime ?? getUserProfile()?.reservationPreferredStartTime ?? "10:00");
    setSelectedPlace(null);
    setPlaces([]);
    setOpenedExternal(false);
    setMessage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  const { events: externalEvents } = useExternalCalendarEvents(date, date);
  const durationMinutes = Math.max(30, Math.min(360, Number(duration) || 60));
  const endTime = minutesToTime(timeToMinutes(startTime) + durationMinutes);
  const suggestedSlots = useMemo(() => {
    if (!date) return [];
    const businessStart = selectedPlace?.businessHoursStart ?? "09:00";
    const businessEnd = selectedPlace?.businessHoursEnd ?? "21:00";
    const earliest = timeToMinutes(businessStart);
    const latest = timeToMinutes(businessEnd);
    return calculateFreeTimeBlocksForDate({
      date,
      routines,
      singleSchedules,
      externalEvents,
    })
      .flatMap((block) => {
        const start = Math.max(timeToMinutes(block.startTime), earliest);
        const end = Math.min(timeToMinutes(block.endTime), latest);
        if (end - start < durationMinutes) return [];
        const lastStart = end - durationMinutes;
        return Array.from(
          { length: Math.min(3, Math.floor((lastStart - start) / 60) + 1) },
          (_, index) => {
            const slotStart = start + index * 60;
            return {
              startTime: minutesToTime(slotStart),
              endTime: minutesToTime(slotStart + durationMinutes),
            };
          }
        );
      })
      .slice(0, 3);
  }, [
    date,
    durationMinutes,
    externalEvents,
    routines,
    selectedPlace,
    singleSchedules,
  ]);

  const hasConflict = singleSchedules.some((schedule) =>
    schedule.date === date && timeToMinutes(schedule.startTime) < timeToMinutes(endTime) && timeToMinutes(schedule.endTime) > timeToMinutes(startTime)
  );

  async function searchPlaces() {
    if (!query.trim()) { setMessage("예약할 장소나 업종을 입력해주세요."); return; }
    setIsSearching(true); setMessage(null); setSelectedPlace(null);
    try {
      const response = await fetch(`/api/places/search?query=${encodeURIComponent(query.trim())}`);
      const data = await response.json() as { places?: SearchPlace[]; error?: string };
      if (!response.ok) throw new Error(data.error || "장소를 찾지 못했어요.");
      setPlaces(data.places ?? []);
      if (!data.places?.length) setMessage("검색 결과가 없어요. 지역명과 업종을 함께 입력해보세요.");
    } catch (error) {
      setPlaces([]); setMessage(error instanceof Error ? error.message : "장소 검색 중 오류가 생겼어요.");
    } finally { setIsSearching(false); }
  }

  function openReservationPage() {
    if (!selectedPlace) { setMessage("먼저 예약할 장소를 선택해주세요."); return; }
    window.open(naverPlaceUrl(selectedPlace), "_blank", "noopener,noreferrer");
    setOpenedExternal(true);
    setMessage("네이버 플레이스에서 날짜·시간·인원을 확인하고 예약을 마쳐주세요.");
  }

  function saveCompletedReservation() {
    if (!selectedPlace || !date || !startTime) { setMessage("장소와 예약 날짜·시간을 확인해주세요."); return; }
    if (hasConflict) { setMessage("기존 일정과 겹칩니다. 아래 빈 시간을 선택한 뒤 저장해주세요."); return; }
    const now = new Date().toISOString();
    const title = selectedItem?.title?.trim() || `${selectedPlace.name} 예약`;
    saveSingleSchedule({
      id: createId(), title, date, startTime, endTime,
      placeName: selectedPlace.name, placeAddress: selectedPlace.address,
      travelMode: getUserProfile()?.preferredTravelMode,
      memo: [`예약 인원 ${Math.max(1, Number(people) || 1)}명`, requestMemo.trim(), "외부 예약 화면에서 사용자 확인 완료"].filter(Boolean).join(" · "),
      color: selectedItem?.color ?? "#8B5CF6", sourceItemId: selectedItem?.id ?? null,
      createdAt: now, updatedAt: now,
    });
    if (!getSavedPlaces().some((place) => place.providerPlaceId === selectedPlace.providerPlaceId || (place.name === selectedPlace.name && place.address === selectedPlace.address))) {
      saveSavedPlace({ id: createId(), name: selectedPlace.name, address: selectedPlace.address, placeType: selectedPlace.placeType, categoryName: selectedPlace.categoryName, phone: selectedPlace.phone, placeUrl: selectedPlace.placeUrl || naverPlaceUrl(selectedPlace), businessHoursStart: selectedPlace.businessHoursStart, businessHoursEnd: selectedPlace.businessHoursEnd, typicalStayMinutes: durationMinutes, memo: "예약 위임에서 저장됨", latitude: selectedPlace.latitude, longitude: selectedPlace.longitude, provider: selectedPlace.provider, providerPlaceId: selectedPlace.providerPlaceId, createdAt: now, updatedAt: now });
    }
    if (selectedItem) updateItem({ ...selectedItem, title, dueDate: date, scheduleStartTime: startTime, scheduleEndTime: endTime, placePreference: "specific", placeName: selectedPlace.name, placeAddress: selectedPlace.address, status: "완료", updatedAt: now });
    setSingleSchedules(getSingleSchedules());
    setMessage("예약을 일정에 저장했어요. 장소 기반 이동 알림에도 반영됩니다.");
    setOpenedExternal(false);
  }

  return <section className="app-card p-5" id="reservation-assistant">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-violet-600">예약 위임</p><h2 className="mt-1 text-xl font-black text-slate-950">장소 찾기부터 일정 저장까지</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">빈 시간을 먼저 고르고, 네이버 플레이스에서 최종 예약한 뒤 한 번에 캘린더에 저장하세요.</p></div><span className="shrink-0 rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">요청 {reservationItems.length}</span></div>

    {reservationItems.length > 0 && <div className="mt-4"><label className="text-xs font-black text-slate-600">처리할 예약 요청</label><select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="new">새 예약 직접 만들기</option>{reservationItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>}

    <div className="mt-4 flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchPlaces()} placeholder="예: 강남 미용실, 집 근처 치과" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-violet-400"/><button type="button" onClick={() => void searchPlaces()} disabled={isSearching} className="shrink-0 rounded-2xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-50">{isSearching ? "검색 중" : "장소 찾기"}</button></div>
    <div className="mt-2 flex flex-wrap gap-2">{["미용실", "병원", "식당", "운동 시설"].map((label) => <button key={label} type="button" onClick={() => setQuery(label)} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500 ring-1 ring-slate-100">{label}</button>)}</div>

    {places.length > 0 && <div className="mt-4 grid gap-2">{places.map((place) => <button key={`${place.provider}-${place.providerPlaceId}-${place.name}`} type="button" onClick={() => { setSelectedPlace(place); setOpenedExternal(false); }} className={`rounded-2xl p-3 text-left ring-1 ${selectedPlace === place ? "bg-violet-50 ring-violet-300" : "bg-slate-50 ring-slate-100"}`}><div className="flex justify-between gap-3"><span className="text-sm font-black text-slate-900">{place.name}</span><span className="shrink-0 text-[11px] font-black text-violet-600">{place.provider === "naver" ? "네이버" : "카카오"}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">{place.address || place.categoryName}</p></button>)}</div>}

    {selectedPlace && <div className="mt-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="font-black text-slate-900">{selectedPlace.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{selectedPlace.address}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><label className="text-xs font-black text-slate-600">날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"/></label><label className="text-xs font-black text-slate-600">시간<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"/></label><label className="text-xs font-black text-slate-600">예상 소요<select value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"><option value="30">30분</option><option value="60">1시간</option><option value="90">1시간 30분</option><option value="120">2시간</option></select></label><label className="text-xs font-black text-slate-600">인원<input type="number" min="1" max="20" value={people} onChange={(e) => setPeople(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm"/></label></div>
      <textarea value={requestMemo} onChange={(e) => setRequestMemo(e.target.value)} placeholder="요청사항 (선택): 창가 자리, 디자이너 지정 등" className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none focus:border-violet-400"/>
      {suggestedSlots.length > 0 && <div className="mt-3"><p className="text-xs font-black text-slate-600">내 일정과 겹치지 않는 시간</p><div className="mt-2 flex flex-wrap gap-2">{suggestedSlots.map((slot) => <button key={slot.startTime} type="button" onClick={() => setStartTime(slot.startTime)} className={`rounded-full px-3 py-2 text-xs font-black ${startTime === slot.startTime ? "bg-blue-600 text-white" : "bg-white text-blue-600 ring-1 ring-blue-100"}`}>{slot.startTime}~{slot.endTime}</button>)}</div></div>}
      {hasConflict && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">선택한 시간이 기존 일정과 겹칩니다. 위의 빈 시간을 선택해주세요.</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={openReservationPage} className="min-h-12 rounded-2xl bg-[#03C75A] px-4 text-sm font-black text-white">네이버에서 예약하기</button><button type="button" onClick={saveCompletedReservation} disabled={!openedExternal || hasConflict} className="min-h-12 rounded-2xl bg-violet-600 px-4 text-sm font-black text-white disabled:bg-slate-300">예약을 마쳤어요 · 일정 저장</button></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-400">실제 예약 확정과 결제는 네이버 플레이스에서 직접 확인합니다. 예약 화면을 연 뒤에만 일정 저장 버튼이 활성화됩니다.</p>
    </div>}
    {message && <p role="status" className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold leading-6 text-violet-700 ring-1 ring-violet-100">{message}</p>}
  </section>;
}
