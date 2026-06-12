import { redirect } from "next/navigation";
import { BriefcaseBusiness, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScoreMeter } from "@/components/score-meter";
import { StatusBadge } from "@/components/status-badge";
import { createJobPost, updateApplicationStatus } from "@/app/recruiter/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import type { Application, JobPost, Profile } from "@/lib/types";

type RecruiterApplication = Application & {
  profiles: Pick<Profile, "full_name" | "organization"> | null;
  job_posts: Pick<JobPost, "title" | "required_skills"> | null;
};

export default async function RecruiterDashboardPage() {
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

  if (profile.role !== "recruiter") {
    redirect("/student/dashboard");
  }

  const { data: jobs } = await supabase
    .from("job_posts")
    .select("id, recruiter_id, title, description, required_skills, experience_level, status, created_at")
    .eq("recruiter_id", user.id)
    .order("created_at", { ascending: false })
    .returns<JobPost[]>();

  const jobIds = (jobs ?? []).map((job) => job.id);
  const { data: applications } = jobIds.length
    ? await supabase
        .from("applications")
        .select("id, student_id, job_id, resume_url, extracted_skills, match_score, status, recruiter_response, created_at, profiles(full_name, organization), job_posts(title, required_skills)")
        .in("job_id", jobIds)
        .order("match_score", { ascending: false })
        .returns<RecruiterApplication[]>()
    : { data: [] as RecruiterApplication[] };

  return (
    <AppShell profile={profile}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Recruiter dashboard</h1>
        <p className="mt-2 text-slate-600">
          Create hiring posts, review ranked applications, and respond to students.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <BriefcaseBusiness className="text-teal-700" size={20} />
            <h2 className="text-xl font-semibold">Create job post</h2>
          </div>
          <form action={createJobPost} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Role title
              <input
                required
                name="title"
                className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
                placeholder="Frontend Developer Intern"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Description
              <textarea
                required
                name="description"
                rows={4}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-teal-700"
                placeholder="Describe project, responsibilities, and expectations."
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Required skills
              <input
                required
                name="requiredSkills"
                className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
                placeholder="react, next.js, typescript, git"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Experience level
              <select
                name="experienceLevel"
                className="h-11 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-700"
                defaultValue="internship"
              >
                <option value="internship">Internship</option>
                <option value="entry">Entry level</option>
                <option value="mid">Mid level</option>
                <option value="senior">Senior</option>
              </select>
            </label>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
              <Send size={17} />
              Post requirement
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Ranked applications</h2>
          <div className="grid gap-4">
            {(applications ?? []).map((application) => (
              <article
                key={application.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {application.profiles?.full_name ?? "Student applicant"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Applied for {application.job_posts?.title ?? "your post"}
                    </p>
                    {application.profiles?.organization ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {application.profiles.organization}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={application.status} />
                </div>

                <div className="mt-4">
                  <ScoreMeter score={application.match_score} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {application.extracted_skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={application.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                  >
                    View resume
                  </a>
                </div>

                <form action={updateApplicationStatus} className="mt-4 grid gap-3">
                  <input type="hidden" name="applicationId" value={application.id} />
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <select
                      name="status"
                      defaultValue={application.status}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-teal-700"
                    >
                      <option value="pending">Pending</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="rejected">Rejected</option>
                      <option value="accepted">Accepted</option>
                    </select>
                    <input
                      name="recruiterResponse"
                      defaultValue={application.recruiter_response ?? ""}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-teal-700"
                      placeholder="Optional response for student"
                    />
                    <button className="h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800">
                      Save
                    </button>
                  </div>
                </form>
              </article>
            ))}
            {(applications ?? []).length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600">
                Student applications will appear here after they apply to your posts.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Your job posts</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(jobs ?? []).map((job) => (
            <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold">{job.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p>
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
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
