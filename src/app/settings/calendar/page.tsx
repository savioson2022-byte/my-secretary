import BottomNavigation from "@/components/BottomNavigation";
import ExternalCalendarInspector from "@/components/ExternalCalendarInspector";
import ExternalCalendarSettingsCard from "@/components/ExternalCalendarSettingsCard";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export const metadata = {
  title: "캘린더 연동",
};

export default function CalendarIntegrationSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="캘린더 연동"
        description="iPhone 캘린더의 일정을 읽어 빈 시간을 정확하게 계산합니다."
        helpTopic="calendar-integration"
      />

      <div className="space-y-4">
        <ExternalCalendarSettingsCard />
        <ExternalCalendarInspector />
      </div>

      <BottomNavigation />
    </main>
  );
}
