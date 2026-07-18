import AccountManager from "@/components/AccountManager";
import BottomNavigation from "@/components/BottomNavigation";
import CloudSyncStatusCard from "@/components/CloudSyncStatusCard";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export default function AccountSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="계정과 동기화"
        description="로그인한 계정과 아이폰·맥북의 데이터 동기화 상태를 관리합니다."
      />
      <div className="space-y-5">
        <AccountManager />
        <CloudSyncStatusCard />
      </div>
      <BottomNavigation />
    </main>
  );
}
