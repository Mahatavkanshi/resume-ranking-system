-- Run this in Supabase SQL Editor if recruiters cannot create job posts.
-- It repairs the required columns, policies, and adds a safe RPC fallback.

do $$
begin
  create type public.user_role as enum ('student', 'recruiter');
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

alter table public.job_posts
  add column if not exists recruiter_id uuid references public.profiles(id) on delete cascade;

alter table public.job_posts
  add column if not exists title text;

alter table public.job_posts
  add column if not exists description text;

alter table public.job_posts
  add column if not exists required_skills text[] not null default '{}';

alter table public.job_posts
  add column if not exists experience_level public.experience_level not null default 'internship';

alter table public.job_posts
  add column if not exists status public.job_status not null default 'open';

alter table public.job_posts
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;
alter table public.job_posts enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

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

create or replace function public.create_recruiter_job_post(
  post_title text,
  post_description text,
  post_required_skills text[],
  post_experience_level text
)
returns public.job_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  created_post public.job_posts;
  auth_email text;
  auth_name text;
begin
  select email, raw_user_meta_data ->> 'full_name'
  into auth_email, auth_name
  from auth.users
  where id = auth.uid();

  if auth.uid() is null then
    raise exception 'You must be signed in to create a job post';
  end if;

  insert into public.profiles (id, full_name, role, organization)
  values (
    auth.uid(),
    coalesce(nullif(auth_name, ''), split_part(coalesce(auth_email, 'New user'), '@', 1), 'New user'),
    'recruiter',
    null
  )
  on conflict (id) do update
  set role = 'recruiter'
  where public.profiles.id = auth.uid();

  insert into public.job_posts (
    recruiter_id,
    title,
    description,
    required_skills,
    experience_level,
    status
  )
  values (
    auth.uid(),
    post_title,
    post_description,
    coalesce(post_required_skills, '{}'),
    case
      when post_experience_level in ('internship', 'entry', 'mid', 'senior')
        then post_experience_level::public.experience_level
      else 'internship'::public.experience_level
    end,
    'open'
  )
  returning * into created_post;

  return created_post;
end;
$$;

grant execute on function public.create_recruiter_job_post(
  text,
  text,
  text[],
  text
) to authenticated;

create or replace function public.list_open_job_posts()
returns table (
  id uuid,
  recruiter_id uuid,
  title text,
  description text,
  required_skills text[],
  experience_level public.experience_level,
  status public.job_status,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    job_posts.id,
    job_posts.recruiter_id,
    job_posts.title,
    job_posts.description,
    job_posts.required_skills,
    job_posts.experience_level,
    job_posts.status,
    job_posts.created_at
  from public.job_posts
  where job_posts.status = 'open'
  order by job_posts.created_at desc;
$$;

grant execute on function public.list_open_job_posts() to authenticated;
