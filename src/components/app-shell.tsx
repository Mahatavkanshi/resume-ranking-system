import Link from "next/link";
import { LogOut } from "lucide-react";
import type { Profile } from "@/lib/types";

type AppShellProps = {
  profile: Profile;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f3ec] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/dashboard" className="font-semibold">
            Resume Ranking System
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {profile.full_name} · {profile.role}
            </span>
            <form action="/auth/signout" method="post">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                title="Sign out"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
    </main>
  );
}
