import { AuthForm } from "@/components/auth-form";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f3ec] px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Continue to your student or recruiter dashboard.
        </p>
        <div className="mt-6">
          <AuthForm mode="login" error={params.error} />
        </div>
      </section>
    </main>
  );
}
