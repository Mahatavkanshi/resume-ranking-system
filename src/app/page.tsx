import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: BriefcaseBusiness,
    title: "Recruiter workspace",
    text: "Post developer requirements, review applicants, and update hiring responses from one secure dashboard.",
  },
  {
    icon: GraduationCap,
    title: "Student portal",
    text: "Browse open roles, upload resumes, and track every application status without confusion.",
  },
  {
    icon: Sparkles,
    title: "Skill-based ranking",
    text: "Match resumes against required skills with a transparent score that is easy to improve later.",
  },
  {
    icon: ShieldCheck,
    title: "Supabase security",
    text: "Role-based pages and database policies keep student and recruiter data separated.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f3ec] text-slate-950">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div className="flex flex-col justify-center">
          <div className="mb-8 flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <ShieldCheck size={16} />
            Final-year resume ranking system
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Secure hiring dashboards for recruiters and students.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            A Next.js and Supabase project where recruiters post tech roles,
            students apply with resumes, and the system ranks applications by
            matched skills.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create account <ArrowRight size={18} />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-500"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="flex items-center">
          <div className="grid w-full gap-4">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <feature.icon className="mb-4 text-teal-700" size={26} />
                <h2 className="text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 leading-7 text-slate-600">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
