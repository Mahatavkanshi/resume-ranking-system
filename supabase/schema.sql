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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  organization text,
  created_at timestamptz not null default now()
);

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
  resume_url text not null,
  extracted_skills text[] not null default '{}',
  match_score integer not null default 0 check (match_score >= 0 and match_score <= 100),
  status public.application_status not null default 'pending',
  recruiter_response text,
  created_at timestamptz not null default now(),
  unique (student_id, job_id)
);

create index if not exists applications_job_score_idx on public.applications(job_id, match_score desc);
create index if not exists job_posts_recruiter_idx on public.job_posts(recruiter_id, created_at desc);

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.job_posts enable row level security;
alter table public.applications enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Recruiters can read applicant profiles" on public.profiles;
create policy "Recruiters can read applicant profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.applications a
    join public.job_posts j on j.id = a.job_id
    where a.student_id = profiles.id
      and j.recruiter_id = auth.uid()
  )
);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Students can read open jobs" on public.job_posts;
create policy "Students can read open jobs"
on public.job_posts for select
to authenticated
using (status = 'open');

drop policy if exists "Recruiters can manage their jobs" on public.job_posts;
create policy "Recruiters can manage their jobs"
on public.job_posts for all
to authenticated
using (recruiter_id = auth.uid())
with check (
  recruiter_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'recruiter'
  )
);

drop policy if exists "Students can create their applications" on public.applications;
create policy "Students can create their applications"
on public.applications for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  )
  and exists (
    select 1 from public.job_posts
    where id = job_id and status = 'open'
  )
);

drop policy if exists "Students can read their applications" on public.applications;
create policy "Students can read their applications"
on public.applications for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Recruiters can read applications for their jobs" on public.applications;
create policy "Recruiters can read applications for their jobs"
on public.applications for select
to authenticated
using (
  exists (
    select 1 from public.job_posts
    where job_posts.id = applications.job_id
      and job_posts.recruiter_id = auth.uid()
  )
);

drop policy if exists "Recruiters can update applications for their jobs" on public.applications;
create policy "Recruiters can update applications for their jobs"
on public.applications for update
to authenticated
using (
  exists (
    select 1 from public.job_posts
    where job_posts.id = applications.job_id
      and job_posts.recruiter_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.job_posts
    where job_posts.id = applications.job_id
      and job_posts.recruiter_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do update set public = true;

drop policy if exists "Students can upload their resume files" on storage.objects;
create policy "Students can upload their resume files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Authenticated users can read resume files" on storage.objects;
create policy "Authenticated users can read resume files"
on storage.objects for select
to authenticated
using (bucket_id = 'resumes');
