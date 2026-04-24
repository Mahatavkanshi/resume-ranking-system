-- Run this in Supabase SQL editor.
-- Candidate passwords are handled securely by Supabase Auth (hashed), not plain text.

create extension if not exists pgcrypto;

create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text not null,
    must_have_skills text[] not null default '{}',
    nice_to_have_skills text[] not null default '{}',
    created_by_email text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.candidate_submissions (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references public.jobs(id) on delete cascade,
    candidate_user_id uuid not null,
    candidate_email text not null,
    file_name text not null,
    file_storage_path text not null,
    score numeric(5,2) not null,
    matched_skills text[] not null default '{}',
    missing_skills text[] not null default '{}',
    created_at timestamptz not null default now()
);

create index if not exists idx_jobs_created_at on public.jobs(created_at desc);
create index if not exists idx_candidate_submissions_job on public.candidate_submissions(job_id);
create index if not exists idx_candidate_submissions_user on public.candidate_submissions(candidate_user_id);

alter table public.jobs enable row level security;
alter table public.candidate_submissions enable row level security;

drop policy if exists jobs_select_authenticated on public.jobs;
create policy jobs_select_authenticated
on public.jobs
for select
to authenticated
using (true);

drop policy if exists jobs_insert_recruiter_only on public.jobs;
create policy jobs_insert_recruiter_only
on public.jobs
for insert
to authenticated
with check (
    lower(auth.jwt() ->> 'email') = 'mahatavkanshisaini@gmail.com'
);

drop policy if exists submissions_insert_candidate_self on public.candidate_submissions;
create policy submissions_insert_candidate_self
on public.candidate_submissions
for insert
to authenticated
with check (
    candidate_user_id = auth.uid()
    and lower(candidate_email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists submissions_select_recruiter_or_owner on public.candidate_submissions;
create policy submissions_select_recruiter_or_owner
on public.candidate_submissions
for select
to authenticated
using (
    lower(auth.jwt() ->> 'email') = 'mahatavkanshisaini@gmail.com'
    or candidate_user_id = auth.uid()
);
