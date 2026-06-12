import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  Contact,
  FileText,
  LayoutDashboard,
  Send,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScoreMeter } from "@/components/score-meter";
import { StatusBadge } from "@/components/status-badge";
import { WrongRolePanel } from "@/components/wrong-role-panel";
import { createJobPost, updateApplicationStatus } from "@/app/recruiter/dashboard/actions";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";
import type { Application, JobPost, Profile, ResumeParseStatus } from "@/lib/types";

type RecruiterApplication = Application & {
  profiles: Pick<Profile, "full_name" | "organization"> | null;
  job_posts: Pick<JobPost, "title" | "required_skills"> | null;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  helper?: string;
};

function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) {
    return <p className="text-sm text-slate-500">No skills detected yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span
          key={skill}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

function ParseBadge({ status }: { status: ResumeParseStatus }) {
  const label = status.replace("_", " ");
  const styles = {
    parsed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-amber-200 bg-amber-50 text-amber-700",
    not_parsed: "border-slate-200 bg-slate-50 text-slate-600",
  }[status];

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${styles}`}>
      {label}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
      {children}
    </p>
  );
}

export default async function RecruiterDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getEffectiveProfile(supabase, user);

  if (profile.role !== "recruiter") {
    return (
      <WrongRolePanel
        currentRole={profile.role}
        expectedRole="recruiter"
        email={profile.email ?? user.email}
        userId={user.id}
      />
    );
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
        .select("id, student_id, job_id, resume_id, resume_url, resume_file_name, resume_file_type, parse_status, extracted_skills, match_score, status, recruiter_response, created_at, profiles(full_name, organization), job_posts(title, required_skills)")
        .in("job_id", jobIds)
        .order("match_score", { ascending: false })
        .returns<RecruiterApplication[]>()
    : { data: [] as RecruiterApplication[] };

  const recruiterJobs = jobs ?? [];
  const receivedApplications = applications ?? [];
  const openPosts = recruiterJobs.filter((job) => job.status === "open").length;
  const matchedCandidates = receivedApplications.filter((application) => application.match_score > 0);
  const bestMatchScore = receivedApplications.reduce(
    (bestScore, application) => Math.max(bestScore, application.match_score),
    0,
  );
  const pendingApplications = receivedApplications.filter((application) => application.status === "pending").length;
  const applicationsByJob = receivedApplications.reduce<Record<string, number>>((counts, application) => {
    counts[application.job_id] = (counts[application.job_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <AppShell profile={profile}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Recruiter dashboard</h1>
        <p className="mt-2 text-slate-600">
          Create posts, receive student resumes, compare skill scores, and contact candidates.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6">
          <nav className="grid gap-2">
            <a
              href="#overview"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
            >
              <LayoutDashboard size={17} />
              Overview
            </a>
            <a
              href="#received-resumes"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <Users size={17} />
              Received resumes
            </a>
            <a
              href="#job-posts"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <FileText size={17} />
              My job posts
            </a>
            <a
              href="#create-post"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <BriefcaseBusiness size={17} />
              Create post
            </a>
          </nav>
        </aside>

        <div className="grid gap-8">
          <section id="overview">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Overview</h2>
              <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                Recruiter only
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Total posts" value={recruiterJobs.length} />
              <MetricCard label="Open posts" value={openPosts} helper="Visible on student dashboard" />
              <MetricCard label="Applied candidates" value={receivedApplications.length} />
              <MetricCard label="Skill matched" value={matchedCandidates.length} helper="Score above 0%" />
              <MetricCard label="Best score" value={`${bestMatchScore}%`} helper={`${pendingApplications} pending`} />
            </div>
          </section>

          <section id="received-resumes">
            <div className="mb-4 flex items-center gap-2">
              <Users className="text-teal-700" size={20} />
              <h2 className="text-xl font-semibold">Received resumes</h2>
            </div>
            <div className="grid gap-4">
              {receivedApplications.map((application) => (
                <article
                  key={application.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {application.profiles?.full_name ?? "Student applicant"}
                        </h3>
                        <StatusBadge status={application.status} />
                        <ParseBadge status={application.parse_status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Applied for {application.job_posts?.title ?? "your post"}
                      </p>
                      {application.profiles?.organization ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {application.profiles.organization}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-48">
                      <ScoreMeter score={application.match_score} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]">
                    <div className="grid gap-3">
                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Detected resume skills</p>
                        <SkillChips skills={application.extracted_skills} />
                      </div>
                      <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                          View candidate details
                        </summary>
                        <div className="mt-3 grid gap-3 text-sm text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-800">Required skills:</span>{" "}
                            {(application.job_posts?.required_skills ?? []).join(", ") || "Not added"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-800">Resume file:</span>{" "}
                            {application.resume_file_name ?? "Uploaded resume"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-800">Recruiter response:</span>{" "}
                            {application.recruiter_response || "No response sent yet"}
                          </p>
                        </div>
                      </details>
                    </div>

                    <div className="grid gap-3">
                      <a
                        href={application.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                      >
                        <FileText size={16} />
                        View resume
                      </a>
                      <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                        <Contact size={16} />
                        Contact after shortlist
                      </span>
                    </div>
                  </div>

                  <form action={updateApplicationStatus} className="mt-5 grid gap-3">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <div className="grid gap-3 lg:grid-cols-[180px_1fr_auto]">
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
                        placeholder="Message shown to student"
                      />
                      <button className="h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800">
                        Save response
                      </button>
                    </div>
                  </form>
                </article>
              ))}
              {receivedApplications.length === 0 ? (
                <EmptyState>
                  No resumes received yet. Once students apply to your open posts, their resumes and match
                  scores will appear here.
                </EmptyState>
              ) : null}
            </div>
          </section>

          <section id="job-posts">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="text-teal-700" size={20} />
              <h2 className="text-xl font-semibold">My job posts</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recruiterJobs.map((job) => (
                <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="mt-1 text-sm capitalize text-slate-500">
                        {job.experience_level} - {job.status}
                      </p>
                    </div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {applicationsByJob[job.id] ?? 0} applied
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p>
                  <div className="mt-4">
                    <SkillChips skills={job.required_skills} />
                  </div>
                </article>
              ))}
              {recruiterJobs.length === 0 ? (
                <EmptyState>Your posts will appear here after you create your first requirement.</EmptyState>
              ) : null}
            </div>
          </section>

          <section id="create-post" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
        </div>
      </div>
    </AppShell>
  );
}
