import BottomNavigation from "@/components/BottomNavigation";
import PurchaseHistoryManager from "@/components/PurchaseHistoryManager";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export default function PurchasePage() {
  return (
    <main className="app-page mx-auto w-full max-w-6xl px-4 lg:px-8">
      <SettingsPageHeader
        title="구매 준비"
        description="이미 구매한 적 있는 상품만 재구매 후보로 관리하고, 확인한 뒤 결제 직전까지 빠르게 이동합니다."
        helpTopic="purchase"
      />

      <PurchaseHistoryManager />

      <BottomNavigation />
    </main>
  );
}
