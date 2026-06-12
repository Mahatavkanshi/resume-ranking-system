export type UserRole = "student" | "recruiter";

export type ApplicationStatus = "pending" | "shortlisted" | "rejected" | "accepted";

export type ExperienceLevel = "internship" | "entry" | "mid" | "senior";

export type ResumeParseStatus = "parsed" | "partial" | "not_parsed";

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
  resume_id: string | null;
  resume_url: string;
  resume_file_name: string | null;
  resume_file_type: string | null;
  parse_status: ResumeParseStatus;
  extracted_skills: string[];
  match_score: number;
  status: ApplicationStatus;
  recruiter_response: string | null;
  created_at: string;
};

export type StudentResume = {
  id: string;
  student_id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
  storage_path: string;
  parse_status: ResumeParseStatus;
  extracted_skills: string[];
  created_at: string;
  updated_at: string;
};
