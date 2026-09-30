-- =============================================================================
-- TutorFlow 0002: identity helpers and auth triggers
-- =============================================================================
-- Why SECURITY DEFINER?
--   RLS policies need facts like "is the caller an admin?". Reading public.profiles from inside a
--   policy ON public.profiles would re-apply that same policy → infinite recursion. A SECURITY DEFINER
--   function runs with its owner's rights (the migration owner, who bypasses RLS), so it can read the
--   table directly and simply return a boolean / id.
--
-- Security implications and mitigations:
--   * They run with elevated rights, so they must only ever answer questions about the CALLER
--     (auth.uid()), never accept an arbitrary user id to look up.
--   * `set search_path = ''` + fully-qualified names stop an attacker from shadowing public.profiles
--     with an object in another schema.
--   * They live in `private`, which Supabase doesn't expose over the REST API.
--   * They are STABLE, and policies call them as `(select private.fn())` so Postgres evaluates
--     them once per statement instead of once per row.

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- The teachers.id of the caller, or NULL if the caller isn't an active teacher.
-- Inactive teachers therefore lose access to schedules/payments immediately.
create or replace function private.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.teachers t
  join public.profiles p on p.id = t.profile_id
  where t.profile_id = (select auth.uid())
    and p.role = 'teacher'
    and t.status <> 'inactive';
$$;

-- Is the given student assigned to the calling teacher?
create or replace function private.is_assigned_to_me(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_students ts
    where ts.student_id = p_student_id
      and ts.teacher_id = private.current_teacher_id()
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.current_user_role(),
  private.is_admin(),
  private.current_teacher_id(),
  private.is_assigned_to_me(uuid)
to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- New login → profile. The role is ALWAYS 'teacher' here.
-- Never read the role from raw_user_meta_data: that JSON is supplied by the client at sign-up.
-- Admins are promoted manually with SQL (see README: "Create the first admin").
-- -----------------------------------------------------------------------------
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
      (select t.full_name from public.teachers t where lower(t.email) = lower(new.email) limit 1),
      split_part(new.email, '@', 1)
    ),
    'teacher'
  );

  -- If the admin already created a teacher record with this email, link it to the new login.
  update public.teachers t
  set profile_id = new.id
  where lower(t.email) = lower(new.email)
    and t.profile_id is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync when a user changes their login email.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Teacher record created AFTER the login exists → link by email.
-- -----------------------------------------------------------------------------
create or replace function private.link_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_id is null then
    select p.id into new.profile_id
    from public.profiles p
    where lower(p.email) = lower(new.email)
      and p.role = 'teacher'
      and not exists (select 1 from public.teachers t where t.profile_id = p.id and t.id <> new.id);
  end if;
  return new;
end;
$$;

create trigger teachers_link_profile
  before insert or update of email on public.teachers
  for each row execute function private.link_teacher_profile();

-- -----------------------------------------------------------------------------
-- Defence in depth for profiles. Column grants (0004) already stop API users from writing `role`;
-- this trigger also blocks it if a grant is ever loosened by mistake.
-- auth.uid() is NULL for trusted contexts (SQL editor, service_role), which may still change roles.
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if new.role is distinct from old.role then
      raise exception 'Changing a role is not allowed' using errcode = '42501';
    end if;
    if new.id is distinct from old.id or new.email is distinct from old.email then
      raise exception 'Profile id and email are managed by the system' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();
