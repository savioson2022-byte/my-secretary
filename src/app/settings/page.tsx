import AccountManager from "@/components/AccountManager";
import AppRuntimeControls from "@/components/AppRuntimeControls";
import BottomNavigation from "@/components/BottomNavigation";
import CloudSyncStatusCard from "@/components/CloudSyncStatusCard";
import LocalDataTransfer from "@/components/LocalDataTransfer";
import MobileInstallGuide from "@/components/MobileInstallGuide";
import SavedPlaceManager from "@/components/SavedPlaceManager";
import UserStatusBadge from "@/components/UserStatusBadge";
import Link from "next/link";

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
        <AppRuntimeControls />
        <AccountManager />
        <CloudSyncStatusCard />

        <section className="app-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                앱 설치와 빠른 실행
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                iPhone에서 앱처럼 열기, TestFlight 준비, 음성 기록 단축어를
                한곳에서 확인합니다.
              </p>
            </div>
            <Link
              href="/app"
              className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
            >
              열기
            </Link>
          </div>
        </section>

        <section className="app-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                구매 자동화
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                이미 산 적 있는 쿠팡 상품만 재구매 후보로 관리합니다.
                결제수단과 비밀번호는 앱에 저장하지 않습니다.
              </p>
            </div>
            <Link
              href="/purchase"
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white"
            >
              열기
            </Link>
          </div>
        </section>

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
        <SavedPlaceManager />
        <LocalDataTransfer />
      </div>

      <BottomNavigation />
    </main>
  );
}
