import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { SavedPlace } from "@/types/calendar";

const savedPlaceRepository =
  createLocalStorageRepository<SavedPlace>(STORAGE_KEYS.savedPlaces);

export function getSavedPlaces(): SavedPlace[] {
  return savedPlaceRepository.list();
}

export function saveSavedPlace(place: SavedPlace) {
  savedPlaceRepository.create(place);
}

export function updateSavedPlace(place: SavedPlace) {
  savedPlaceRepository.update(place);
}

export function deleteSavedPlace(id: string) {
  savedPlaceRepository.delete(id);
}

export function inferSavedPlaceType(
  placeName: string,
  memo = ""
): SavedPlace["placeType"] {
  const text = `${placeName} ${memo}`.toLowerCase();

  if (/(헬스|gym|피트니스|pt|피티|운동)/.test(text)) return "gym";
  if (/(미용|헤어|커트|머리|염색|펌)/.test(text)) return "salon";
  if (/(학교|학원|수업|캠퍼스)/.test(text)) return "school";
  if (/(집|자택|home)/.test(text)) return "home";
  if (/(회사|사무실|office)/.test(text)) return "work";
  if (/(가게|매장|마트|샵|스토어|편의점)/.test(text)) return "shop";

  return "other";
}
