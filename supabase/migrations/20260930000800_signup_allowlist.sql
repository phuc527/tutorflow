-- =============================================================================
-- TutorFlow 0008: self sign-up only for teachers the admin has already added
-- =============================================================================
-- Public sign-ups are enabled so teachers can create their own password at /signup. This trigger
-- keeps the door closed to everyone else: a new login is accepted only if its email matches a
-- teacher record that isn't inactive. Access is still granted by the existing rules (role is always
-- 'teacher'; the teacher record is linked only after the email is confirmed, see 0007).
--
-- Bootstrap: while no admin exists yet, any login may be created, so the first admin can be set up
-- as described in the README. The gate closes as soon as one profile has role 'admin'.
--
-- Runs BEFORE INSERT, so a refused sign-up leaves no row behind. Supabase Auth reports the error to
-- the client as "Database error saving new user"; the app turns that into a readable message.

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
    where lower(t.email) = lower(new.email)
      and t.status <> 'inactive'
  ) then
    raise exception 'Sign-up is only open to teachers added by the administrator'
      using errcode = '42501', detail = 'signup_not_allowed';
  end if;

  return new;
end;
$$;
revoke execute on function private.enforce_signup_allowlist() from public, anon, authenticated;

drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();
