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
    href: "/delegate",
    label: "위임",
    icon: "M6 12h12M13 7l5 5-5 5M5 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5",
  },
  {
    href: "/settings",
    label: "설정",
    icon: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6l-.03.04a2 2 0 0 1-3.94 0L10 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1l-.04-.03a2 2 0 0 1 0-3.94L4 10a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6l.03-.04a2 2 0 0 1 3.94 0L14 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.04.36.25.7.6 1l.04.03a2 2 0 0 1 0 3.94L20 14c-.35.3-.56.64-.6 1Z",
  },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="desktop-side-nav fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] border-t border-slate-100 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_38px_rgba(15,23,42,0.08)] backdrop-blur md:bottom-auto md:right-auto md:top-1/2 md:mx-0 md:w-[88px] md:-translate-y-1/2 md:rounded-2xl md:border md:border-slate-100 md:px-2 md:py-3 md:shadow-soft">
        <div className="grid grid-cols-5 gap-1 md:grid-cols-1">
          {LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href === "/calendar/monthly" &&
                pathname.startsWith("/calendar")) ||
              (link.href === "/delegate" && pathname.startsWith("/delegate")) ||
              (link.href === "/settings" && pathname.startsWith("/settings"));

            return (
              <Link
                key={link.href}
                href={link.href}
                scroll
                className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition ${
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
      <div
        aria-hidden="true"
        className="h-[var(--app-bottom-nav-height)] md:hidden"
      />
    </>
  );
}
