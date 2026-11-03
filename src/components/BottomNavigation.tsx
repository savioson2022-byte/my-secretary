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
  { href: "/schedule/manage", label: "일정관리", icon: "M12 5v14M5 12h14" },
  { href: "/settings", label: "설정", icon: "M4 7h16M4 17h16M8 4v6M16 14v6" },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav aria-label="주 메뉴" className="app-navigation">
        <Link href="/" className="nav-brand">나의 비서<span>일상과 업무를 한곳에서</span></Link>
        <div className="nav-links">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href === "/calendar/monthly" &&
                pathname.startsWith("/calendar")) ||
              (link.href === "/records" && pathname.startsWith("/records")) ||
              (link.href === "/settings" && pathname.startsWith("/settings"));

            return (
              <Link
                key={link.href}
                href={link.href}
                scroll
                aria-current={isActive ? "page" : undefined}
                className={`nav-link ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
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

    </>
  );
}
