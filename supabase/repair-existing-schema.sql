-- Run this in Supabase SQL Editor when login says:
-- "column profiles.role does not exist"
--
-- This repairs an already-created profiles table without deleting users.

do $$
begin
  create type public.user_role as enum ('student', 'recruiter');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists role public.user_role;

alter table public.profiles
  add column if not exists organization text;

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles
  alter column full_name set default 'New user';

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

alter table public.profiles enable row level security;

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

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
