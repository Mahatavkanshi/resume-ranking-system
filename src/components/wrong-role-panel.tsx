import Link from "next/link";
import type { UserRole } from "@/lib/types";

type WrongRolePanelProps = {
  currentRole: UserRole;
  expectedRole: UserRole;
  email?: string | null;
  userId?: string;
};

export function WrongRolePanel({ currentRole, expectedRole, email, userId }: WrongRolePanelProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ec] px-6 py-10 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Wrong account type</h1>
        <p className="mt-3 leading-7 text-slate-600">
          You are currently signed in as <strong>{currentRole}</strong>, but this page is for{" "}
          <strong>{expectedRole}</strong> accounts.
        </p>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Role status</p>
          <p className="mt-1">Saved profile role: {currentRole}</p>
          <p>Needed dashboard role: {expectedRole}</p>
          {email ? <p>Email: {email}</p> : null}
          {userId ? <p className="break-all">User id: {userId}</p> : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          If clicking the role button keeps returning here, run the role repair SQL in Supabase, then click
          the button again.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <form action="/account/switch-role" method="post">
            <input type="hidden" name="role" value={expectedRole} />
            <button className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800">
              Make this account {expectedRole}
            </button>
          </form>
          <Link
            href={`/auth/signout?next=/auth/signup?fresh=1`}
            className="inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Switch account
          </Link>
          <Link
            href={currentRole === "student" ? "/student/dashboard" : "/recruiter/dashboard"}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          >
            Go to my dashboard
          </Link>
        </div>
        <Link
          href="/account/role-debug"
          className="mt-4 inline-flex text-sm font-semibold text-teal-700"
        >
          Open role debug
        </Link>
      </section>
    </main>
  );
}
