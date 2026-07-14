import AccountManager from "@/components/AccountManager";
import BottomNavigation from "@/components/BottomNavigation";
import LocalDataTransfer from "@/components/LocalDataTransfer";
import SavedPlaceManager from "@/components/SavedPlaceManager";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function AccountPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            계정과 기기
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            같은 사용자로 인식할 기기를 연결하고, AI 분류 기준을 관리합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <div className="space-y-5">
        <AccountManager />
        <SavedPlaceManager />
        <LocalDataTransfer />
      </div>

      <BottomNavigation />
    </main>
  );
}
