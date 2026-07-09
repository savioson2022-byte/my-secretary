import BottomNavigation from "@/components/BottomNavigation";
import SavedPlaceManager from "@/components/SavedPlaceManager";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function PlacesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 pb-24">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            장소
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            자주 가는 장소와 방문 조건을 저장해 일정 추천이 실제 동선에 맞게
            작동하도록 만듭니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <SavedPlaceManager />

      <BottomNavigation />
    </main>
  );
}
