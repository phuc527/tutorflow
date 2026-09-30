-- =============================================================================
-- TutorFlow 0007: fixes from the production-readiness review
-- =============================================================================
-- IDs refer to the review report and to the regression tests in supabase/tests/rls.test.mjs
-- ("review findings").

-- -----------------------------------------------------------------------------
-- SEC-1: only CONFIRMED logins may be linked to a teacher record.
-- Before: the link happened on INSERT into auth.users, i.e. at sign-up, before the person proved
-- they own the email. With public sign-ups enabled, anyone knowing a teacher's email could claim it.
-- -----------------------------------------------------------------------------

-- Shared linking routine: link an unlinked teacher record to this user, if the email is confirmed.
create or replace function private.link_teacher_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.teachers t
  set profile_id = u.id
  from auth.users u
  join public.profiles p on p.id = u.id and p.role = 'teacher'
  where u.id = p_user_id
    and u.email_confirmed_at is not null
    and lower(t.email) = lower(u.email)
    and t.profile_id is null
    and not exists (select 1 from public.teachers other where other.profile_id = u.id);

  -- Adopt the teacher's name if the profile still has the placeholder (email local part).
  -- Done here, after confirmation, so an unconfirmed sign-up can't learn a teacher's name.
  update public.profiles p
  set full_name = t.full_name
  from public.teachers t
  where p.id = p_user_id
    and t.profile_id = p.id
    and p.full_name = split_part(p.email, '@', 1);
end;
$$;
revoke execute on function private.link_teacher_for_user(uuid) from public, anon, authenticated;

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
    'teacher' -- never taken from raw_user_meta_data (client-controlled)
  );
  -- Users created with "Auto Confirm" (or already confirmed) are linked right away;
  -- everyone else is linked by on_auth_user_confirmed once they confirm their email.
  perform private.link_teacher_for_user(new.id);
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.handle_user_confirmed();

-- Teacher record created/edited after the login exists: only link a confirmed login.
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
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
    where lower(p.email) = lower(new.email)
      and p.role = 'teacher'
      and not exists (select 1 from public.teachers t where t.profile_id = p.id and t.id <> new.id);
  end if;
  return new;
end;
$$;

-- Undo any link that was made to a login that never confirmed its email.
update public.teachers t
set profile_id = null
from auth.users u
where u.id = t.profile_id
  and u.email_confirmed_at is null;

-- -----------------------------------------------------------------------------
-- SEC-2: deleting a student/teacher must not silently delete schedules (admins may not delete
-- schedules, rule 4). Same policy as payments: records with history are deactivated, not deleted.
-- -----------------------------------------------------------------------------
alter table public.schedules
  drop constraint schedules_teacher_id_fkey,
  add constraint schedules_teacher_id_fkey foreign key (teacher_id) references public.teachers (id) on delete restrict,
  drop constraint schedules_student_id_fkey,
  add constraint schedules_student_id_fkey foreign key (student_id) references public.students (id) on delete restrict;

-- -----------------------------------------------------------------------------
-- SEC-3: payments.schedule_id must point at a schedule of the SAME teacher and student.
-- SECURITY INVOKER on purpose: the lookup runs under the caller's RLS, so a schedule the caller
-- can't see is indistinguishable from one that doesn't exist (no existence oracle via FK errors).
-- Runs BEFORE the foreign-key check.
-- -----------------------------------------------------------------------------
create or replace function private.payments_check_schedule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.schedule_id is not null and not exists (
    select 1 from public.schedules s
    where s.id = new.schedule_id
      and s.teacher_id = new.teacher_id
      and s.student_id = new.student_id
  ) then
    raise exception 'The linked class does not belong to this teacher and student'
      using errcode = '23514', detail = 'payments_schedule_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_check_schedule on public.payments;
create trigger payments_check_schedule
  before insert or update of schedule_id, teacher_id, student_id on public.payments
  for each row execute function private.payments_check_schedule();

-- -----------------------------------------------------------------------------
-- SEC-4: avatar_url must be https (no javascript:/data: URLs).
-- -----------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~* '^https://');

-- -----------------------------------------------------------------------------
-- PAY-1: a PAID record's amount is frozen (mark it unpaid first; that change is audited),
-- and every history row records the amount at that moment.
-- -----------------------------------------------------------------------------
alter table public.payment_history add column if not exists amount numeric(12, 0);

create or replace function private.payments_set_status_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'paid' and new.status = 'paid'
     and new.amount is distinct from old.amount then
    raise exception 'The amount of a paid record cannot be changed. Mark it unpaid first.'
      using errcode = '23514', detail = 'payments_amount_locked';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.marked_by := coalesce((select auth.uid()), new.marked_by);
    new.paid_at := case when new.status = 'paid' then now() else null end;
  else
    new.paid_at := old.paid_at;
    new.marked_by := old.marked_by;
  end if;

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace function private.payments_write_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.payment_history (payment_id, old_status, new_status, changed_by, amount)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      new.marked_by,
      new.amount
    );
  end if;
  return new;
end;
$$;

-- Backfill history amounts for rows written before this migration (best available value).
update public.payment_history h
set amount = p.amount
from public.payments p
where p.id = h.payment_id and h.amount is null;

-- -----------------------------------------------------------------------------
-- DB-1: index foreign keys used by ON DELETE actions and joins.
-- -----------------------------------------------------------------------------
create index if not exists payments_schedule_idx on public.payments (schedule_id);
create index if not exists payments_marked_by_idx on public.payments (marked_by);
create index if not exists schedules_created_by_idx on public.schedules (created_by);
create index if not exists payment_history_changed_by_idx on public.payment_history (changed_by);

-- Keep private helpers off the API roles (functions added in this migration included).
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.current_user_role(),
  private.is_admin(),
  private.current_teacher_id(),
  private.is_assigned_to_me(uuid)
to authenticated, service_role;
