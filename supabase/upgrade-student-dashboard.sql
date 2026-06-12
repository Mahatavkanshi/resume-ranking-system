-- Run this in Supabase SQL Editor for the upgraded student dashboard.
-- It adds reusable student resumes, resume parse status, and application resume metadata.

do $$
begin
  create type public.resume_parse_status as enum ('parsed', 'partial', 'not_parsed');
exception
  when duplicate_object then null;
end $$;

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
