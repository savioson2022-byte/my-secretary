import Link from "next/link";
import BottomNavigation from "@/components/BottomNavigation";
import UserStatusBadge from "@/components/UserStatusBadge";
import PageHelpButton from "@/components/PageHelpButton";

type SettingsGroup = {
  title: string;
  note?: string;
  items: {
    href: string;
    title: string;
    description: string;
    color: string;
    icon: string;
  }[];
};

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "내 정보",
    items: [
      {
        href: "/settings/account",
        title: "계정과 동기화",
        description: "로그인, 연결된 기기, 데이터 동기화",
        color: "bg-blue-600",
        icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 9a7 7 0 0 0-14 0",
      },
    ],
  },
  {
    title: "앱 동작",
    items: [
      {
        href: "/settings/calendar",
        title: "캘린더 연동",
        description: "iPhone 캘린더를 읽어 빈 시간을 정확하게 계산",
        color: "bg-indigo-500",
        icon: "M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
      },
      {
        href: "/settings/notifications",
        title: "알림과 알람",
        description: "일정, 이동, 루틴, 재구매 알림",
        color: "bg-rose-500",
        icon: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
      },
      {
        href: "/settings/shortcuts",
        title: "빠른 실행",
        description: "아이폰 단축어, 뒷면 탭, 음성 기록",
        color: "bg-amber-500",
        icon: "m13 2-9 12h7l-1 8 9-12h-7l1-8Z",
      },
      {
        href: "/settings/places",
        title: "장소와 이동",
        description: "저장 장소와 이동시간 기본값",
        color: "bg-emerald-500",
        icon: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
      },
    ],
  },
  {
    title: "실험실",
    note: "아직 다듬는 중인 기능입니다. 켜두면 동작하지만 바뀔 수 있어요.",
    items: [
      {
        href: "/settings/ai",
        title: "개인 AI",
        description: "기기 안에서 도는 Gemma 모델과 학습 기록",
        color: "bg-violet-500",
        icon: "M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
      },
      {
        href: "/purchase",
        title: "구매 기록과 재구매",
        description: "메일에서 주문을 읽어와 재구매 주기를 추정",
        color: "bg-teal-600",
        icon: "M6 6h15l-1.5 9h-12L5 3H2m5 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm11 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
      },
      {
        href: "/delegate",
        title: "위임",
        description: "비서에게 넘긴 작업의 진행 상황",
        color: "bg-slate-500",
        icon: "M6 12h12M13 7l5 5-5 5M5 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5",
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">설정</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            바꾸려는 항목을 선택하면 세부 설정을 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2"><PageHelpButton topic="settings" /><UserStatusBadge /></div>
      </header>

      <div className="space-y-7">
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 px-1 text-xs font-black text-slate-400">
              {group.title}
            </h2>
            {group.note && (
              <p className="mb-2 px-1 text-xs font-semibold leading-5 text-slate-400">
                {group.note}
              </p>
            )}
            <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-100">
              {group.items.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[76px] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${item.color}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={item.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">
                      {item.title}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-2xl text-slate-300" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <BottomNavigation />
    </main>
  );
}
