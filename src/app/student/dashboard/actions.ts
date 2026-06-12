"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculateMatchScore, extractSkillsFromText, extractTextFromResume } from "@/lib/skills";
import { createClient } from "@/lib/supabase/server";
import type { JobPost, Profile, StudentResume } from "@/lib/types";

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".rtf", ".png", ".jpg", ".jpeg"];

const uploadResumeSchema = z.object({
  resume: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Resume is required")
    .refine((file) => file.size <= MAX_RESUME_SIZE, "Resume must be 10 MB or smaller")
    .refine((file) => {
      const name = file.name.toLowerCase();

      return ALLOWED_RESUME_EXTENSIONS.some((extension) => name.endsWith(extension));
    }, "Upload a resume file: PDF, DOC, DOCX, TXT, RTF, PNG, JPG, or JPEG"),
});

const applySchema = z.object({
  jobId: z.string().uuid(),
});

const cancelSchema = z.object({
  applicationId: z.string().uuid(),
});

async function requireStudent() {
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

  if (profile?.role !== "student") {
    redirect("/recruiter/dashboard");
  }

  return { supabase, user, profile };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function uploadStudentResume(formData: FormData) {
  const parsed = uploadResumeSchema.safeParse({
    resume: formData.get("resume"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Please upload a valid resume.");
  }

  const { supabase, user } = await requireStudent();
  const resume = parsed.data.resume;
  const { text, parseStatus } = await extractTextFromResume(resume);
  const extractedSkills = extractSkillsFromText(text);
  const fileName = safeFileName(resume.name);
  const storagePath = `${user.id}/latest-${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, resume, {
      upsert: false,
      contentType: resume.type || "application/octet-stream",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicResume } = supabase.storage.from("resumes").getPublicUrl(storagePath);

  const { error: upsertError } = await supabase.from("student_resumes").upsert(
    {
      student_id: user.id,
      file_name: resume.name,
      file_type: resume.type || null,
      file_url: publicResume.publicUrl,
      storage_path: storagePath,
      parse_status: parseStatus,
      extracted_skills: extractedSkills,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  revalidatePath("/student/dashboard");
}

export async function applyToJob(formData: FormData) {
  const parsed = applySchema.safeParse({
    jobId: formData.get("jobId"),
  });

  if (!parsed.success) {
    throw new Error("Please choose a valid job.");
  }

  const { supabase, user } = await requireStudent();

  const [{ data: job, error: jobError }, { data: latestResume, error: resumeError }] =
    await Promise.all([
      supabase
        .from("job_posts")
        .select("id, required_skills")
        .eq("id", parsed.data.jobId)
        .eq("status", "open")
        .single<Pick<JobPost, "id" | "required_skills">>(),
      supabase
        .from("student_resumes")
        .select("id, file_name, file_type, file_url, parse_status, extracted_skills")
        .eq("student_id", user.id)
        .single<
          Pick<
            StudentResume,
            "id" | "file_name" | "file_type" | "file_url" | "parse_status" | "extracted_skills"
          >
        >(),
    ]);

  if (jobError || !job) {
    throw new Error("This job post is not available.");
  }

  if (resumeError || !latestResume) {
    throw new Error("Upload your resume first, then apply to recruiter posts.");
  }

  const matchScore = calculateMatchScore(job.required_skills, latestResume.extracted_skills);

  const { error: insertError } = await supabase.from("applications").insert({
    student_id: user.id,
    job_id: job.id,
    resume_id: latestResume.id,
    resume_url: latestResume.file_url,
    resume_file_name: latestResume.file_name,
    resume_file_type: latestResume.file_type,
    parse_status: latestResume.parse_status,
    extracted_skills: latestResume.extracted_skills,
    match_score: matchScore,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/recruiter/dashboard");
}

export async function cancelApplication(formData: FormData) {
  const parsed = cancelSchema.safeParse({
    applicationId: formData.get("applicationId"),
  });

  if (!parsed.success) {
    throw new Error("Invalid application.");
  }

  const { supabase, user } = await requireStudent();

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", parsed.data.applicationId)
    .eq("student_id", user.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/recruiter/dashboard");
}
