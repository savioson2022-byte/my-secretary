import BottomNavigation from "@/components/BottomNavigation";
import GeofenceSettingsCard from "@/components/GeofenceSettingsCard";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export const metadata = {
  title: "장소 감지",
};

export default function PlaceSensingSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="장소 감지"
        description="저장한 장소에 도착하면 앱이 알아채고 지금 할 수 있는 일을 꺼냅니다."
        backHref="/settings"
        helpTopic="place-sensing"
      />

      <GeofenceSettingsCard />

      <BottomNavigation />
    </main>
  );
}
