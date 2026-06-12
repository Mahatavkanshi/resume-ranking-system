import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
    fresh?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && params.fresh !== "1") {
    redirect("/auth/signout?next=/auth/signup?fresh=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ec] px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose the correct role because it controls which dashboard you can use.
        </p>
        <div className="mt-6">
          <AuthForm mode="signup" error={params.error} />
        </div>
      </section>
    </main>
  );
}
