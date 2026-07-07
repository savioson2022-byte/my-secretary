"use client";

import { FormEvent, useState } from "react";
import type { SavedPlace } from "@/types/calendar";

export type PlaceSearchResult = Pick<
  SavedPlace,
  | "provider"
  | "providerPlaceId"
  | "name"
  | "address"
  | "latitude"
  | "longitude"
  | "categoryName"
  | "phone"
  | "placeUrl"
  | "placeType"
  | "businessHoursStart"
  | "businessHoursEnd"
>;

type PlaceKeywordSearchProps = {
  defaultQuery?: string;
  onSelect: (place: PlaceSearchResult) => void;
};

export default function PlaceKeywordSearch({
  defaultQuery = "",
  onSelect,
}: PlaceKeywordSearchProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [places, setPlaces] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setMessage("검색할 장소 이름을 입력해줘.");
      return;
    }

    setIsSearching(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/places/search?query=${encodeURIComponent(trimmedQuery)}`
      );
      const data = (await response.json()) as {
        places?: PlaceSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        setMessage(data.error ?? "장소 검색에 실패했습니다.");
        setPlaces([]);
        return;
      }

      setPlaces(data.places ?? []);
      if ((data.places ?? []).length === 0) {
        setMessage("검색 결과가 없습니다.");
      }
    } catch {
      setMessage("장소 검색 중 오류가 발생했습니다.");
      setPlaces([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-100">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="가게 이름 검색"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300"
        >
          {isSearching ? "검색중" : "검색"}
        </button>
      </form>

      {message && (
        <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
          {message}
        </p>
      )}

      {places.length > 0 && (
        <div className="mt-3 max-h-64 space-y-2 overflow-auto pr-1">
          {places.map((place) => (
            <button
              key={`${place.provider}-${place.providerPlaceId}`}
              type="button"
              onClick={() => onSelect(place)}
              className="w-full rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-100 transition hover:bg-blue-50"
            >
              <p className="text-sm font-black text-slate-900">
                {place.name}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {place.address}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {place.categoryName && (
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                    {place.categoryName.split(">").at(-1)?.trim()}
                  </span>
                )}
                {place.businessHoursStart && place.businessHoursEnd && (
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-blue-600">
                    기본 {place.businessHoursStart}-{place.businessHoursEnd}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
