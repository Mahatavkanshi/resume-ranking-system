-- Run this in Supabase SQL Editor for the upgraded student dashboard.
-- It adds reusable student resumes, resume parse status, and application resume metadata.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum ('student', 'recruiter');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.application_status as enum ('pending', 'shortlisted', 'rejected', 'accepted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.experience_level as enum ('internship', 'entry', 'mid', 'senior');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_status as enum ('open', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.resume_parse_status as enum ('parsed', 'partial', 'not_parsed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'New user',
  role public.user_role not null default 'student',
  organization text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text default 'New user';

alter table public.profiles
  add column if not exists role public.user_role default 'student';

alter table public.profiles
  add column if not exists organization text;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

update public.profiles
set full_name = 'New user'
where full_name is null;

update public.profiles
set role = 'student'
where role is null;

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  alter column role set not null;

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  required_skills text[] not null default '{}',
  experience_level public.experience_level not null default 'internship',
  status public.job_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.job_posts(id) on delete cascade,
  resume_url text not null default '',
  extracted_skills text[] not null default '{}',
  match_score integer not null default 0 check (match_score >= 0 and match_score <= 100),
  status public.application_status not null default 'pending',
  recruiter_response text,
  created_at timestamptz not null default now(),
  unique (student_id, job_id)
);

create table if not exists public.student_resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_type text,
  file_url text not null,
  storage_path text not null,
  parse_status public.resume_parse_status not null default 'not_parsed',
  extracted_skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

alter table public.applications
  add column if not exists resume_id uuid references public.student_resumes(id) on delete set null;

alter table public.applications
  add column if not exists resume_file_name text;

alter table public.applications
  add column if not exists resume_file_type text;

alter table public.applications
  add column if not exists parse_status public.resume_parse_status not null default 'not_parsed';

create index if not exists student_resumes_student_idx on public.student_resumes(student_id, updated_at desc);
create index if not exists applications_job_score_idx on public.applications(job_id, match_score desc);
create index if not exists job_posts_recruiter_idx on public.job_posts(recruiter_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.job_posts enable row level security;
alter table public.applications enable row level security;
alter table public.student_resumes enable row level security;

drop policy if exists "Students can manage their resumes" on public.student_resumes;
create policy "Students can manage their resumes"
on public.student_resumes for all
to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  )
);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do update set public = true;
