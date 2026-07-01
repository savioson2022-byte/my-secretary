import AccountManager from "@/components/AccountManager";
import BottomNavigation from "@/components/BottomNavigation";

export default function AccountPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-24">
      <header className="mb-5">
        <p className="text-sm font-black text-blue-600">나의 비서</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          계정과 기기
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          같은 사용자로 인식할 기기를 연결하고, AI 분류 기준을 관리합니다.
        </p>
      </header>

      <AccountManager />

      <BottomNavigation />
    </main>
  );
}
