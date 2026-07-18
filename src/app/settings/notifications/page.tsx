import BottomNavigation from "@/components/BottomNavigation";
import NotificationSettingsCard from "@/components/NotificationSettingsCard";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export default function NotificationSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="알림과 알람"
        description="일정, 이동, 재구매, 루틴 알림과 지속 알람의 동작을 설정합니다."
      />
      <NotificationSettingsCard />
      <BottomNavigation />
    </main>
  );
}
