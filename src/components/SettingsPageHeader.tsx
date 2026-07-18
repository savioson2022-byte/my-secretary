import Link from "next/link";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function SettingsPageHeader({
  title,
  description,
  backHref = "/settings",
  backLabel = "설정",
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={backHref}
          aria-label={`${backLabel} 화면으로 돌아가기`}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>{backLabel}</span>
        </Link>
        <UserStatusBadge />
      </div>
      <div className="min-w-0">
        <h1 className="text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </header>
  );
}
