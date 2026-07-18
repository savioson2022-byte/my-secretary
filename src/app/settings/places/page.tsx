import BottomNavigation from "@/components/BottomNavigation";
import SavedPlaceManager from "@/components/SavedPlaceManager";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export default function PlaceSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="장소와 이동"
        description="자주 가는 장소와 이동시간 계산에 사용할 기본 위치를 관리합니다."
      />
      <SavedPlaceManager />
      <BottomNavigation />
    </main>
  );
}
