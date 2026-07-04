"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/",
    label: "홈",
    icon: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z",
  },
  {
    href: "/calendar/monthly",
    label: "캘린더",
    icon: "M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  },
  {
    href: "/records",
    label: "기록",
    icon: "M7 4h10a2 2 0 0 1 2 2v15l-7-3-7 3V6a2 2 0 0 1 2-2Z",
  },
  {
    href: "/schedule/manage",
    label: "일정관리",
    icon: "M4 6h16M4 12h10M4 18h16M17 10l3 3-3 3",
  },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-slate-100 bg-white/92 px-4 pb-3 pt-2 backdrop-blur md:rounded-b-[38px]">
      <div className="grid grid-cols-4 gap-1">
        {LINKS.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href === "/calendar/monthly" &&
              pathname.startsWith("/calendar")) ||
            (link.href === "/schedule/manage" &&
              pathname.startsWith("/schedule"));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition ${
                isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill={isActive ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={link.icon} />
              </svg>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
