import Link from "next/link";
import BottomNavigation from "@/components/BottomNavigation";
import UserStatusBadge from "@/components/UserStatusBadge";

const SETTINGS_GROUPS = [
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
      {
        href: "/settings/ai",
        title: "개인 AI",
        description: "Gemma 모델과 개인 AI 학습 기록",
        color: "bg-violet-500",
        icon: "M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
      },
    ],
  },
  {
    title: "앱 동작",
    items: [
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
        <UserStatusBadge />
      </header>

      <div className="space-y-7">
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 px-1 text-xs font-black text-slate-400">
              {group.title}
            </h2>
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
