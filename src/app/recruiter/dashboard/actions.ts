"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseSkillList } from "@/lib/skills";
import { getEffectiveProfile } from "@/lib/effective-profile";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/types";

const jobSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  requiredSkills: z.string().min(2),
  experienceLevel: z.enum(["internship", "entry", "mid", "senior"]),
});

const statusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["pending", "shortlisted", "rejected", "accepted"]),
  recruiterResponse: z.string().max(500).optional(),
});

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

export async function createJobPost(formData: FormData) {
  const parsed = jobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    requiredSkills: formData.get("requiredSkills"),
    experienceLevel: formData.get("experienceLevel"),
  });

  if (!parsed.success) {
    throw new Error("Please fill all job fields correctly.");
  }

  const { supabase, user } = await requireRecruiter();

  const { error } = await supabase.from("job_posts").insert({
    recruiter_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    required_skills: parseSkillList(parsed.data.requiredSkills),
    experience_level: parsed.data.experienceLevel,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/recruiter/dashboard");
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
