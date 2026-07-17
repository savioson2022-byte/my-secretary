import AccountManager from "@/components/AccountManager";
import BottomNavigation from "@/components/BottomNavigation";
import CloudSyncStatusCard from "@/components/CloudSyncStatusCard";
import GemmaOnDeviceSettingsCard from "@/components/GemmaOnDeviceSettingsCard";
import NotificationSettingsCard from "@/components/NotificationSettingsCard";
import SavedPlaceManager from "@/components/SavedPlaceManager";
import ShortcutSetupCard from "@/components/ShortcutSetupCard";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function SettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            설정
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            로그인, 기기 연결, 분류 기준, 이동시간 기본값을 관리합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <div className="space-y-5">
        <AccountManager />
        <CloudSyncStatusCard />
        <GemmaOnDeviceSettingsCard />
        <ShortcutSetupCard />

        <NotificationSettingsCard />

        <SavedPlaceManager />
      </div>

      <BottomNavigation />
    </main>
  );
}
