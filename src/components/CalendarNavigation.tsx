"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/schedule/manage",
    label: "일정관리",
  },
  {
    href: "/calendar/monthly",
    label: "월간 캘린더",
  },
  {
    href: "/calendar/weekly",
    label: "주간 캘린더",
  },
  {
    href: "/calendar/single",
    label: "단기 일정",
  },
];

export default function CalendarNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-card p-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {LINKS.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? "rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white shadow-[0_10px_22px_rgba(49,130,246,0.22)]"
                  : "rounded-2xl bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-500 hover:bg-white"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
