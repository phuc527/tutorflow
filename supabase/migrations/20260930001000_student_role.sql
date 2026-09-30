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
