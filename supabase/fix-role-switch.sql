-- Run this if clicking "Switch to recruiter" still returns to the student dashboard.
-- It ensures the profiles.role column and self-update policy exist.

do $$
begin
  create type public.user_role as enum ('student', 'recruiter');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists full_name text default 'New user';

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists role public.user_role default 'student';

alter table public.profiles
  add column if not exists organization text;

update public.profiles
set role = 'student'
where role is null;

update public.profiles
set full_name = 'New user'
where full_name is null;

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  alter column role set not null;

alter table public.profiles enable row level security;

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

create or replace function public.switch_my_role(next_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
  auth_email text;
  auth_name text;
begin
  select email, raw_user_meta_data ->> 'full_name'
  into auth_email, auth_name
  from auth.users
  where id = auth.uid();

  insert into public.profiles (id, full_name, email, role, organization)
  values (
    auth.uid(),
    coalesce(nullif(auth_name, ''), split_part(coalesce(auth_email, 'New user'), '@', 1), 'New user'),
    auth_email,
    next_role,
    null
  )
  on conflict (id) do update
  set role = excluded.role,
      email = coalesce(public.profiles.email, excluded.email)
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'No authenticated user found for role switch';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.switch_my_role(public.user_role) to authenticated;

create or replace function public.set_my_role(next_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  update public.profiles
  set role = next_role
  where id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'No profile found for current user';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_my_role(public.user_role) to authenticated;
