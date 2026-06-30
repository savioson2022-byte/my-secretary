import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { SavedPlace } from "@/types/calendar";

const SAVED_PLACE_STORAGE_KEY = "my-assistant-saved-places";
const savedPlaceRepository =
  createLocalStorageRepository<SavedPlace>(SAVED_PLACE_STORAGE_KEY);

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
