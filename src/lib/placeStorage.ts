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
