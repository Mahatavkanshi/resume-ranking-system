export type UserRole = "student" | "recruiter";

export type ApplicationStatus = "pending" | "shortlisted" | "rejected" | "accepted";

export type ExperienceLevel = "internship" | "entry" | "mid" | "senior";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  organization: string | null;
};

export type JobPost = {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  required_skills: string[];
  experience_level: ExperienceLevel;
  status: "open" | "closed";
  created_at: string;
};

export type Application = {
  id: string;
  student_id: string;
  job_id: string;
  resume_url: string;
  extracted_skills: string[];
  match_score: number;
  status: ApplicationStatus;
  recruiter_response: string | null;
  created_at: string;
};
