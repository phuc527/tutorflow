-- =============================================================================
-- TutorFlow 0010: student role, admin-managed roles, student read-only access
-- =============================================================================
-- Spec: docs/superpowers/specs/2026-09-30-student-role-design.md
-- Every new login is a student. The admin switches accounts between student and teacher with
-- set_user_role(); admin itself is only ever granted with SQL. Students read their own data only
-- through the my_* functions below; no table policy is opened to them.

-- -----------------------------------------------------------------------------
-- Role value and default
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'teacher', 'student'));
alter table public.profiles alter column role set default 'student';

-- -----------------------------------------------------------------------------
-- student_accounts: which login may see which student (a parent may see several children)
-- -----------------------------------------------------------------------------
create table public.student_accounts (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  linked_at   timestamptz not null default now(),
  primary key (profile_id, student_id)
);
create index student_accounts_student_idx on public.student_accounts (student_id);

alter table public.student_accounts enable row level security;
revoke all on public.student_accounts from anon;
-- Written only by triggers and admin functions.
revoke insert, update, delete, truncate, references, trigger on public.student_accounts from authenticated;

create policy student_accounts_admin_select on public.student_accounts
  for select to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Automatic linking by confirmed email
-- -----------------------------------------------------------------------------
create or replace function private.link_student_accounts_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_accounts (profile_id, student_id)
  select p.id, s.id
  from public.profiles p
  join auth.users u on u.id = p.id and u.email_confirmed_at is not null
  join public.students s on lower(s.email) = lower(u.email)
  where p.id = p_user_id
    and p.role = 'student'
  on conflict do nothing;
end;
$$;
revoke execute on function private.link_student_accounts_for_user(uuid) from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'student' -- never taken from raw_user_meta_data (client-controlled)
  );
  -- Auto-confirmed users are linked right away; others when they confirm (handle_user_confirmed).
  perform private.link_teacher_for_user(new.id);
  perform private.link_student_accounts_for_user(new.id);
  return new;
end;
$$;

create or replace function private.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.link_teacher_for_user(new.id);
  perform private.link_student_accounts_for_user(new.id);
  return new;
end;
$$;

-- A student record gets (or changes) its email: link the matching confirmed student logins, and
-- drop links of logins whose email no longer matches, so a corrected typo can't leak data.
create or replace function private.link_student_accounts_for_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.student_accounts sa
    using auth.users u
    where sa.student_id = new.id
      and u.id = sa.profile_id
      and lower(u.email) is distinct from lower(new.email);
  end if;

  if new.email is not null then
    insert into public.student_accounts (profile_id, student_id)
    select p.id, new.id
    from public.profiles p
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
    where p.role = 'student'
      and lower(u.email) = lower(new.email)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function private.link_student_accounts_for_student() from public, anon, authenticated;

create trigger students_link_accounts
  after insert or update of email on public.students
  for each row execute function private.link_student_accounts_for_student();

-- -----------------------------------------------------------------------------
-- Sign-up gate (replaces 0008): a non-inactive teacher's email or any student's email.
-- Open while no admin exists, so the first admin can be created.
-- -----------------------------------------------------------------------------
create or replace function private.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.role = 'admin') then
    return new;
  end if;

  if not exists (
    select 1 from public.teachers t
    where lower(t.email) = lower(new.email) and t.status <> 'inactive'
  ) and not exists (
    select 1 from public.students s
    where lower(s.email) = lower(new.email)
  ) then
    raise exception 'Sign-up is only open to people registered with the tutoring center'
      using errcode = '42501', detail = 'signup_not_allowed';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Role changes by the admin
-- -----------------------------------------------------------------------------
-- The profiles guard refuses role changes from API sessions. set_user_role proves it is the caller by
-- writing a one-time token both to a private table (clients can't write there) and to a
-- transaction-local setting; the guard allows the change only when the two match.
create table private.role_change_tokens (
  token uuid primary key,
  created_at timestamptz not null default now()
);
revoke all on private.role_change_tokens from public, anon, authenticated;

create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid := nullif(current_setting('tutorflow.role_change', true), '')::uuid;
begin
  if (select auth.uid()) is not null then
    if new.role is distinct from old.role and not (
      v_token is not null and exists (select 1 from private.role_change_tokens t where t.token = v_token)
    ) then
      raise exception 'Changing a role is not allowed' using errcode = '42501';
    end if;
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'Profile id and email are managed by the system' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_token   uuid := gen_random_uuid();
begin
  if not private.is_admin() then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('student', 'teacher') then
    raise exception 'Role must be student or teacher' using errcode = '22023', detail = 'role_invalid';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501', detail = 'role_self';
  end if;

  select p.role into v_current from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if v_current = 'admin' then
    raise exception 'Administrator accounts can only be changed in the database'
      using errcode = '42501', detail = 'role_admin_target';
  end if;
  if v_current = p_role then
    return;
  end if;

  insert into private.role_change_tokens (token) values (v_token);
  perform set_config('tutorflow.role_change', v_token::text, true);
  update public.profiles set role = p_role where id = p_user_id;
  perform set_config('tutorflow.role_change', '', true);
  delete from private.role_change_tokens where token = v_token;

  if p_role = 'teacher' then
    delete from public.student_accounts where profile_id = p_user_id;
    perform private.link_teacher_for_user(p_user_id);
  else
    update public.teachers set profile_id = null where profile_id = p_user_id;
    perform private.link_student_accounts_for_user(p_user_id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Manual student links (admin)
-- -----------------------------------------------------------------------------
create or replace function public.link_student_account(p_profile_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can link accounts' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.role = 'student') then
    raise exception 'Only student accounts can be linked to students'
      using errcode = '22023', detail = 'link_not_student';
  end if;
  insert into public.student_accounts (profile_id, student_id)
  values (p_profile_id, p_student_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unlink_student_account(p_profile_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can unlink accounts' using errcode = '42501';
  end if;
  delete from public.student_accounts
  where profile_id = p_profile_id and student_id = p_student_id;
end;
$$;

revoke execute on function
  public.set_user_role(uuid, text),
  public.link_student_account(uuid, uuid),
  public.unlink_student_account(uuid, uuid)
from public, anon;
grant execute on function
  public.set_user_role(uuid, text),
  public.link_student_account(uuid, uuid),
  public.unlink_student_account(uuid, uuid)
to authenticated;
