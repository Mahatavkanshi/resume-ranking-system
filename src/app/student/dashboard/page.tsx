import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  BriefcaseBusiness,
  CircleCheck,
  FileText,
  LayoutDashboard,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScoreMeter } from "@/components/score-meter";
import { StatusBadge } from "@/components/status-badge";
import { WrongRolePanel } from "@/components/wrong-role-panel";
import {
  applyToJob,
  cancelApplication,
  reparseStudentResume,
  uploadStudentResume,
} from "@/app/student/dashboard/actions";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";
import type { Application, JobPost, ResumeParseStatus, StudentResume } from "@/lib/types";

type StudentApplication = Application & {
  job_posts: Pick<JobPost, "title" | "required_skills"> | null;
};

type StudentDashboardProps = {
  searchParams: Promise<{
    tab?: string;
    q?: string;
  }>;
};

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "posts", label: "View Recruiter Posts", icon: Search },
  { id: "applications", label: "My Applications", icon: BriefcaseBusiness },
  { id: "resume", label: "My Resume", icon: FileText },
];

const parseLabels: Record<ResumeParseStatus, string> = {
  parsed: "Parsed",
  partial: "Partial",
  not_parsed: "Not parsed",
};

const parseStyles: Record<ResumeParseStatus, string> = {
  parsed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  not_parsed: "border-slate-200 bg-slate-50 text-slate-700",
};

function ParseBadge({ status }: { status: ResumeParseStatus }) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${parseStyles[status]}`}>
      {parseLabels[status]}
    </span>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) {
    return <span className="text-sm text-slate-500">No known skills detected.</span>;
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
      {children}
    </p>
  );
}

export default async function StudentDashboardPage({ searchParams }: StudentDashboardProps) {
  await connection();

  const params = await searchParams;
  const activeTab = tabs.some((tab) => tab.id === params.tab) ? params.tab! : "overview";
  const query = (params.q ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getEffectiveProfile(supabase, user);

  if (profile.role !== "student") {
    return (
      <WrongRolePanel
        currentRole={profile.role}
        expectedRole="student"
        email={profile.email ?? user.email}
        userId={user.id}
      />
    );
  }

  const [
    { data: jobs, error: jobsError },
    { data: applications },
    { data: resume },
  ] = await Promise.all([
    supabase
      .from("job_posts")
      .select("id, recruiter_id, title, description, required_skills, experience_level, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .returns<JobPost[]>(),
    supabase
      .from("applications")
      .select("id, student_id, job_id, resume_id, resume_url, resume_file_name, resume_file_type, parse_status, extracted_skills, match_score, status, recruiter_response, created_at, job_posts(title, required_skills)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .returns<StudentApplication[]>(),
    supabase
      .from("student_resumes")
      .select("id, student_id, file_name, file_type, file_url, storage_path, parse_status, extracted_skills, created_at, updated_at")
      .eq("student_id", user.id)
      .maybeSingle<StudentResume>(),
  ]);

  let openJobs = jobs ?? [];
  let openJobsError = jobsError?.message;

  if (openJobs.length === 0) {
    const { data: rpcJobs, error: rpcJobsError } = await supabase
      .rpc("list_open_job_posts")
      .returns<JobPost[]>();

    if (rpcJobsError) {
      openJobsError =
        jobsError?.message ??
        `${rpcJobsError.message}. Run supabase/run-this-first.sql in Supabase SQL Editor to repair recruiter post visibility.`;
    } else {
      const rpcJobsResult = rpcJobs as unknown as JobPost[] | JobPost | null;
      openJobs = Array.isArray(rpcJobsResult)
        ? rpcJobsResult
        : rpcJobsResult
          ? [rpcJobsResult]
          : [];
      openJobsError = undefined;
    }
  }

  const appliedJobIds = new Set((applications ?? []).map((application) => application.job_id));
  const filteredJobs = openJobs.filter((job) => {
    if (!query) {
      return true;
    }

    return (
      job.title.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query) ||
      job.required_skills.some((skill) => skill.toLowerCase().includes(query))
    );
  });
  const shortlistedCount = (applications ?? []).filter(
    (application) => application.status === "shortlisted" || application.status === "accepted",
  ).length;
  const bestScore = Math.max(0, ...(applications ?? []).map((application) => application.match_score));
  const profileFields = [profile.full_name, profile.organization, resume?.file_url];
  const profileCompletion = Math.round(
    (profileFields.filter(Boolean).length / profileFields.length) * 100,
  );

  return (
    <AppShell profile={profile}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Student dashboard</h1>
        <p className="mt-2 text-slate-600">
          Manage your resume, explore recruiter posts, apply to jobs, and track responses.
        </p>
        {openJobsError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Recruiter posts could not load: {openJobsError}
          </p>
        ) : null}
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={`/student/dashboard?tab=${tab.id}`}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                isActive
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <div className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Profile completion</p>
              <p className="mt-2 text-3xl font-semibold">{profileCompletion}%</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Open posts</p>
              <p className="mt-2 text-3xl font-semibold">{openJobs.length}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Applications</p>
              <p className="mt-2 text-3xl font-semibold">{(applications ?? []).length}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Shortlisted</p>
              <p className="mt-2 text-3xl font-semibold">{shortlistedCount}</p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Best match</p>
              <p className="mt-2 text-3xl font-semibold">{bestScore}%</p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.85fr_0.85fr_1.3fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Profile completion</h2>
              <div className="mt-4 h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-teal-700"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="font-semibold text-slate-700">Name</dt>
                  <dd className="mt-1 text-slate-600">{profile.full_name}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">College</dt>
                  <dd className="mt-1 text-slate-600">
                    {profile.organization ?? "Not added yet"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Resume skills</dt>
                  <dd className="mt-2">
                    <SkillChips skills={resume?.extracted_skills ?? []} />
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">My Resume</h2>
                {resume ? <ParseBadge status={resume.parse_status} /> : null}
              </div>
              {resume ? (
                <div className="grid gap-4">
                  <p className="font-medium">{resume.file_name}</p>
                  <SkillChips skills={resume.extracted_skills} />
                  <Link
                    href="/student/dashboard?tab=resume"
                    className="inline-flex h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-slate-500"
                  >
                    Manage resume
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4">
                  <p className="leading-7 text-slate-600">
                    Upload your resume once, then use it to apply to recruiter posts.
                  </p>
                  <Link
                    href="/student/dashboard?tab=resume"
                    className="inline-flex h-10 w-fit items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
                  >
                    Upload resume
                  </Link>
                </div>
              )}
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Application status tracker</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {(["pending", "shortlisted", "accepted", "rejected"] as const).map((status) => (
                  <div key={status} className="rounded-md border border-slate-200 p-3">
                    <StatusBadge status={status} />
                    <p className="mt-3 text-2xl font-semibold">
                      {(applications ?? []).filter((application) => application.status === status).length}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Shortlisted or accepted applications: {shortlistedCount}
              </p>
            </article>
          </section>
        </div>
      ) : null}

      {activeTab === "posts" ? (
        <section>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">View Recruiter Posts</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open jobs appear here automatically after recruiters post them.
              </p>
            </div>
            <form className="flex gap-2" action="/student/dashboard">
              <input type="hidden" name="tab" value="posts" />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700"
                placeholder="Search skill or title"
              />
              <button className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
                Search
              </button>
            </form>
          </div>

          <div className="grid gap-4">
            {filteredJobs.map((job) => {
              const alreadyApplied = appliedJobIds.has(job.id);

              return (
                <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <p className="mt-2 leading-7 text-slate-600">{job.description}</p>
                    </div>
                    <span className="w-fit rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold capitalize text-teal-800">
                      {job.experience_level}
                    </span>
                  </div>
                  <div className="mt-4">
                    <SkillChips skills={job.required_skills} />
                  </div>
                  <form action={applyToJob} className="mt-5 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      disabled={alreadyApplied || !resume}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CircleCheck size={17} />
                      {alreadyApplied ? "Applied" : "Apply with my resume"}
                    </button>
                    {!resume ? (
                      <Link href="/student/dashboard?tab=resume" className="text-sm font-semibold text-teal-700">
                        Upload resume first
                      </Link>
                    ) : null}
                  </form>
                </article>
              );
            })}
            {filteredJobs.length === 0 ? (
              <EmptyState>
                {openJobsError
                  ? "Recruiter posts could not load because Supabase blocked the query."
                  : "No matching recruiter posts yet."}
              </EmptyState>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "applications" ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold">My Applications</h2>
          <div className="grid gap-4">
            {(applications ?? []).map((application) => (
              <article key={application.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {application.job_posts?.title ?? "Job post"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Applied on {new Date(application.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <div className="mt-4">
                  <ScoreMeter score={application.match_score} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <ParseBadge status={application.parse_status} />
                  <a
                    href={application.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-teal-700"
                  >
                    {application.resume_file_name ?? "View resume"}
                  </a>
                </div>
                <div className="mt-4">
                  <SkillChips skills={application.extracted_skills} />
                </div>
                {application.recruiter_response ? (
                  <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {application.recruiter_response}
                  </p>
                ) : null}
                {application.status === "pending" ? (
                  <form action={cancelApplication} className="mt-4">
                    <input type="hidden" name="applicationId" value={application.id} />
                    <button className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:border-red-300">
                      <XCircle size={16} />
                      Cancel application
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
            {(applications ?? []).length === 0 ? (
              <EmptyState>Your applications will appear here after you apply.</EmptyState>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "resume" ? (
        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Upload className="text-teal-700" size={20} />
              <h2 className="text-xl font-semibold">{resume ? "Replace resume" : "Upload resume"}</h2>
            </div>
            <form action={uploadStudentResume} className="grid gap-4">
              <input
                required
                type="file"
                name="resume"
                accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <p className="text-sm leading-6 text-slate-600">
                Supported files: PDF, DOC, DOCX, TXT, RTF, PNG, JPG, JPEG. Images and scanned
                resumes are stored, but skills are not auto-detected yet.
              </p>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                <Upload size={17} />
                {resume ? "Replace resume" : "Upload resume"}
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Current resume</h2>
            {resume ? (
              <div className="mt-4 grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{resume.file_name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Updated {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ParseBadge status={resume.parse_status} />
                </div>
                <a
                  href={resume.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-slate-500"
                >
                  View stored resume
                </a>
                <form action={reparseStudentResume}>
                  <button className="inline-flex h-10 w-fit items-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800">
                    Re-parse resume
                  </button>
                </form>
                <div>
                  <h3 className="mb-3 font-semibold">Detected skills</h3>
                  <SkillChips skills={resume.extracted_skills} />
                </div>
                {resume.parse_status === "partial" ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    This resume text was read, but no skills from the current beginner skill list
                    were found. Try adding skills like React, JavaScript, Python, SQL, Git, or Supabase.
                  </p>
                ) : null}
                {resume.parse_status === "not_parsed" ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                    This resume is stored successfully, but no readable text was found. Click
                    Re-parse resume once after parser updates. If it still stays not parsed,
                    the PDF is probably scanned/image-based and needs OCR.
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState>No resume uploaded yet.</EmptyState>
            )}
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
