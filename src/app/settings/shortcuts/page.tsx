import BottomNavigation from "@/components/BottomNavigation";
import SettingsPageHeader from "@/components/SettingsPageHeader";
import ShortcutSetupCard from "@/components/ShortcutSetupCard";

export default function ShortcutSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="빠른 실행"
        description="아이폰 단축어와 뒷면 탭으로 음성 기록을 바로 시작합니다."
      />
      <ShortcutSetupCard />
      <BottomNavigation />
    </main>
  );
}
