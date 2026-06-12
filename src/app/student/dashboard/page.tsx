import { redirect } from "next/navigation";
import { FileUp, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScoreMeter } from "@/components/score-meter";
import { StatusBadge } from "@/components/status-badge";
import { applyToJob } from "@/app/student/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import type { Application, JobPost, Profile } from "@/lib/types";

type StudentApplication = Application & {
  job_posts: Pick<JobPost, "title" | "required_skills"> | null;
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.role !== "student") {
    redirect("/recruiter/dashboard");
  }

  const [{ data: jobs }, { data: applications }] = await Promise.all([
    supabase
      .from("job_posts")
      .select("id, recruiter_id, title, description, required_skills, experience_level, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .returns<JobPost[]>(),
    supabase
      .from("applications")
      .select("id, student_id, job_id, resume_url, extracted_skills, match_score, status, recruiter_response, created_at, job_posts(title, required_skills)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .returns<StudentApplication[]>(),
  ]);

  const appliedJobIds = new Set((applications ?? []).map((application) => application.job_id));

  return (
    <AppShell profile={profile}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Student dashboard</h1>
        <p className="mt-2 text-slate-600">
          Browse open tech roles, upload your resume, and follow recruiter responses.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Search className="text-teal-700" size={20} />
            <h2 className="text-xl font-semibold">Open recruiter posts</h2>
          </div>
          <div className="grid gap-4">
            {(jobs ?? []).map((job) => {
              const alreadyApplied = appliedJobIds.has(job.id);

              return (
                <article
                  key={job.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <p className="mt-2 leading-7 text-slate-600">{job.description}</p>
                    </div>
                    <span className="w-fit rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold capitalize text-teal-800">
                      {job.experience_level}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.required_skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <form action={applyToJob} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input type="hidden" name="jobId" value={job.id} />
                    <input
                      required
                      disabled={alreadyApplied}
                      type="file"
                      name="resume"
                      accept=".pdf,.txt"
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      disabled={alreadyApplied}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileUp size={17} />
                      {alreadyApplied ? "Applied" : "Apply"}
                    </button>
                  </form>
                </article>
              );
            })}
            {(jobs ?? []).length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600">
                No open recruiter posts yet.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">My applications</h2>
          <div className="grid gap-4">
            {(applications ?? []).map((application) => (
              <article
                key={application.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {application.job_posts?.title ?? "Job post"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(application.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <div className="mt-4">
                  <ScoreMeter score={application.match_score} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {application.extracted_skills.length > 0 ? (
                    application.extracted_skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No known skills detected.</span>
                  )}
                </div>
                {application.recruiter_response ? (
                  <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {application.recruiter_response}
                  </p>
                ) : null}
              </article>
            ))}
            {(applications ?? []).length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600">
                Your applications will appear here after you apply.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
