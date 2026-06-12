-- Run this once in Supabase SQL Editor before using the recruiter contact view.
-- It lets the dashboard show candidate emails beside received resumes.

alter table public.profiles
  add column if not exists email text;
