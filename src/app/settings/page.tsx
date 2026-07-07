import AccountManager from "@/components/AccountManager";
import BottomNavigation from "@/components/BottomNavigation";
import CloudSyncStatusCard from "@/components/CloudSyncStatusCard";
import LocalDataTransfer from "@/components/LocalDataTransfer";
import MobileInstallGuide from "@/components/MobileInstallGuide";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-24">
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

        <section className="app-card p-5">
          <h2 className="text-lg font-black text-slate-900">기본값</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            앞으로 알림 시간, 기본 일정 길이, 기본 색인, 음성 기록 방식 같은
            세부 설정을 이곳에 추가할 예정입니다.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {["알림 기본값", "일정 기본값", "음성 기록", "캘린더 표시"].map(
              (label) => (
                <div
                  key={label}
                  className="rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-500 ring-1 ring-slate-100"
                >
                  {label}
                </div>
              )
            )}
          </div>
        </section>

        <MobileInstallGuide />
        <LocalDataTransfer />
      </div>

      <BottomNavigation />
    </main>
  );
}
