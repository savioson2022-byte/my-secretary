import BottomNavigation from "@/components/BottomNavigation";
import PurchaseHistoryManager from "@/components/PurchaseHistoryManager";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function PurchasePage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            구매 자동화
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            이미 구매한 적 있는 상품만 재구매 후보로 관리하고, 로컬 기기에서
            쿠팡 결제 직전까지 빠르게 이동합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <PurchaseHistoryManager />

      <BottomNavigation />
    </main>
  );
}
