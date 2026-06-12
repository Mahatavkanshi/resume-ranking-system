"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculateMatchScore, extractSkillsFromText, extractTextFromResume } from "@/lib/skills";
import { createClient } from "@/lib/supabase/server";
import type { JobPost } from "@/lib/types";

const applySchema = z.object({
  jobId: z.string().uuid(),
  resume: z.instanceof(File).refine((file) => file.size > 0, "Resume is required"),
});

export async function applyToJob(formData: FormData) {
  const parsed = applySchema.safeParse({
    jobId: formData.get("jobId"),
    resume: formData.get("resume"),
  });

  if (!parsed.success) {
    throw new Error("Please choose a valid job and resume file.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student") {
    redirect("/recruiter/dashboard");
  }

  const { data: job, error: jobError } = await supabase
    .from("job_posts")
    .select("id, required_skills")
    .eq("id", parsed.data.jobId)
    .eq("status", "open")
    .single<Pick<JobPost, "id" | "required_skills">>();

  if (jobError || !job) {
    throw new Error("This job post is not available.");
  }

  const resume = parsed.data.resume;
  const text = await extractTextFromResume(resume);
  const extractedSkills = extractSkillsFromText(text);
  const matchScore = calculateMatchScore(job.required_skills, extractedSkills);
  const safeName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const resumePath = `${user.id}/${job.id}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(resumePath, resume, {
      upsert: false,
      contentType: resume.type || "application/octet-stream",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicResume } = supabase.storage.from("resumes").getPublicUrl(resumePath);

  const { error: insertError } = await supabase.from("applications").insert({
    student_id: user.id,
    job_id: job.id,
    resume_url: publicResume.publicUrl,
    extracted_skills: extractedSkills,
    match_score: matchScore,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/recruiter/dashboard");
}
