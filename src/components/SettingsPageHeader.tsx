import Link from "next/link";
import UserStatusBadge from "@/components/UserStatusBadge";

export default function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm font-black text-blue-600"
        >
          <span aria-hidden="true">‹</span> 설정
        </Link>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <UserStatusBadge />
    </header>
  );
}
