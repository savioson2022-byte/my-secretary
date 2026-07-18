import Link from "next/link";
import BottomNavigation from "@/components/BottomNavigation";
import GemmaOnDeviceSettingsCard from "@/components/GemmaOnDeviceSettingsCard";
import SettingsPageHeader from "@/components/SettingsPageHeader";

export default function AiSettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <SettingsPageHeader
        title="개인 AI"
        description="기기용 Gemma 모델과 내 피드백을 바탕으로 쌓인 개인화 기준을 관리합니다."
      />
      <div className="space-y-5">
        <GemmaOnDeviceSettingsCard />
        <Link
          href="/settings/personal-ai"
          className="app-card flex items-center justify-between gap-4 p-5 transition hover:border-blue-200"
        >
          <span>
            <span className="block text-lg font-black text-slate-900">학습 기록</span>
            <span className="mt-1 block text-sm leading-6 text-slate-500">
              분류 수정과 시간 추천 피드백을 확인하고 잘못된 기억을 삭제합니다.
            </span>
          </span>
          <span className="text-2xl text-slate-300" aria-hidden="true">›</span>
        </Link>
      </div>
      <BottomNavigation />
    </main>
  );
}
