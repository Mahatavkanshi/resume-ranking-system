"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseSkillList } from "@/lib/skills";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/types";

type CreatedJobPost = {
  id: string;
  status: "open" | "closed";
};

const jobSchema = z.object({
  title: z.string().trim(),
  description: z.string().trim(),
  requiredSkills: z.string().trim(),
  experienceLevel: z.enum(["internship", "entry", "mid", "senior"]).default("internship"),
});

const statusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["pending", "shortlisted", "rejected", "accepted"]),
  recruiterResponse: z.string().max(500).optional(),
});

function redirectWithMessage(type: "notice" | "error", message: string): never {
  redirect(`/recruiter/dashboard?${type}=${encodeURIComponent(message)}&fresh=${Date.now()}#create-post`);
}

function getJobPostErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("create_recruiter_job_post") ||
    lowerMessage.includes("schema cache") ||
    lowerMessage.includes("function")
  ) {
    return "Database setup is missing for recruiter posts. Run supabase/run-this-first.sql in Supabase SQL Editor, then try again.";
  }

  if (lowerMessage.includes("row-level security") || lowerMessage.includes("violates row-level security")) {
    return "Supabase blocked the post because recruiter RLS is not ready. Run supabase/run-this-first.sql in Supabase SQL Editor, then try again.";
  }

  return message;
}

async function requireRecruiter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getEffectiveProfile(supabase, user, { sync: true });

  if (profile.role !== "recruiter") {
    redirect("/student/dashboard");
  }

  return { supabase, user };
}

async function ensureRecruiterDatabaseRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update({ role: "recruiter" })
    .eq("id", userId)
    .select("role")
    .maybeSingle<{ role: "student" | "recruiter" }>();

  if (updatedProfile?.role === "recruiter") {
    return;
  }

  const { data: rpcProfile, error: rpcError } = await supabase.rpc("switch_my_role", {
    next_role: "recruiter",
  });

  if (rpcError || !rpcProfile) {
    throw new Error(
      updateError?.message ??
        rpcError?.message ??
        "Recruiter role is not saved in Supabase. Run supabase/fix-role-switch.sql, then try posting again.",
    );
  }
}

export async function createJobPost(formData: FormData) {
  const rawExperienceLevel = String(formData.get("experienceLevel") ?? "internship");
  const parsed = jobSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    requiredSkills: String(formData.get("requiredSkills") ?? ""),
    experienceLevel: ["internship", "entry", "mid", "senior"].includes(rawExperienceLevel)
      ? rawExperienceLevel
      : "internship",
  });

  if (!parsed.success) {
    redirectWithMessage(
      "error",
      parsed.error.issues[0]?.message ?? "Please fill all job fields correctly.",
    );
  }

  const { supabase, user } = await requireRecruiter();
  const title = parsed.data.title || "Untitled tech role";
  const description = parsed.data.description || "No description provided yet.";
  const requiredSkills = parseSkillList(parsed.data.requiredSkills);
  const safeRequiredSkills = requiredSkills.length > 0 ? requiredSkills : ["general"];
  let createdJobId: string | undefined;

  try {
    await ensureRecruiterDatabaseRole(supabase, user.id);
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "Recruiter role could not be verified in Supabase.",
    );
  }

  const { data: insertedJob, error } = await supabase
    .from("job_posts")
    .insert({
      recruiter_id: user.id,
      title,
      description,
      required_skills: safeRequiredSkills,
      experience_level: parsed.data.experienceLevel,
      status: "open",
    })
    .select("id, status")
    .single<CreatedJobPost>();

  if (insertedJob?.id) {
    createdJobId = insertedJob.id;
  }

  if (error) {
    const { data: rpcJobs, error: rpcError } = await supabase
      .rpc("create_recruiter_job_post", {
        post_title: title,
        post_description: description,
        post_required_skills: safeRequiredSkills,
        post_experience_level: parsed.data.experienceLevel,
      })
      .returns<CreatedJobPost[]>();

    if (rpcError) {
      redirectWithMessage(
        "error",
        getJobPostErrorMessage(rpcError.message),
      );
    }

    const rpcJob = Array.isArray(rpcJobs)
      ? rpcJobs[0]
      : (rpcJobs as unknown as CreatedJobPost | null);

    if (rpcJob?.id) {
      createdJobId = rpcJob.id;
    }
  }

  if (!createdJobId) {
    redirectWithMessage(
      "error",
      "Supabase did not return the created post. Run supabase/run-this-first.sql in Supabase SQL Editor, then try again.",
    );
  }

  const { data: visibleJob, error: visibilityError } = await supabase
    .from("job_posts")
    .select("id, status")
    .eq("id", createdJobId)
    .eq("recruiter_id", user.id)
    .maybeSingle<CreatedJobPost>();

  if (visibilityError || !visibleJob) {
    redirectWithMessage(
      "error",
      `Post was saved, but the dashboard cannot read it yet. Run supabase/run-this-first.sql in Supabase SQL Editor. Supabase message: ${
        visibilityError?.message ?? "no readable row returned"
      }`,
    );
  }

  if (visibleJob.status !== "open") {
    redirectWithMessage(
      "error",
      "Post was saved, but it is not open, so students cannot see it. Check the job_posts.status default in Supabase.",
    );
  }

  revalidatePath("/recruiter/dashboard");
  revalidatePath("/student/dashboard");
  redirectWithMessage("notice", "Job post created. Students can now see it in View Recruiter Posts.");
}

export async function updateApplicationStatus(formData: FormData) {
  const parsed = statusSchema.safeParse({
    applicationId: formData.get("applicationId"),
    status: formData.get("status") as ApplicationStatus,
    recruiterResponse: formData.get("recruiterResponse"),
  });

  if (!parsed.success) {
    throw new Error("Invalid application update.");
  }

  const { supabase } = await requireRecruiter();

  const { error } = await supabase
    .from("applications")
    .update({
      status: parsed.data.status,
      recruiter_response: parsed.data.recruiterResponse || null,
    })
    .eq("id", parsed.data.applicationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/recruiter/dashboard");
  revalidatePath("/student/dashboard");
}
