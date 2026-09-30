-- =============================================================================
-- TutorFlow 0004: privileges and Row Level Security
-- =============================================================================
-- Two layers, both enforced by Postgres for every API request:
--   1. GRANTs decide which OPERATIONS and COLUMNS a database role may touch at all.
--   2. RLS policies decide which ROWS those operations apply to.
-- Supabase maps every logged-in request to the `authenticated` role and every logged-out one to `anon`.
--
-- Access matrix
--   table             admin                         teacher
--   profiles          read all                      read/update own (name, phone, avatar only)
--   teachers          full CRUD                     read own record
--   students          full CRUD                     read assigned students
--   teacher_students  read, assign, unassign        read own assignments
--   schedules         read all (NO writes)          CRUD own, only for assigned students
--   payments          read all (NO writes)          read own; create/update for assigned students
--   payment_history   read all                      read history of own payments
-- Nobody may delete payments or write payment_history via the API.

alter table public.profiles         enable row level security;
alter table public.teachers         enable row level security;
alter table public.students         enable row level security;
alter table public.teacher_students enable row level security;
alter table public.schedules        enable row level security;
alter table public.payments         enable row level security;
alter table public.payment_history  enable row level security;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
-- Logged-out visitors get nothing.
revoke all on all tables in schema public from anon;
-- TRUNCATE bypasses RLS entirely; REFERENCES/TRIGGER are never needed by clients.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Start from "no writes", then grant only the columns a client may legitimately set.
revoke insert, update, delete on all tables in schema public from authenticated;

grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- teachers.profile_id is managed by the linking trigger, never by the client.
grant insert (full_name, email, phone, specialization, hourly_rate, status),
      update (full_name, email, phone, specialization, hourly_rate, status),
      delete
  on public.teachers to authenticated;

grant insert (full_name, email, phone, parent_name, parent_phone, grade, status, notes),
      update (full_name, email, phone, parent_name, parent_phone, grade, status, notes),
      delete
  on public.students to authenticated;

grant insert (teacher_id, student_id), delete on public.teacher_students to authenticated;

-- created_by is set by trigger.
grant insert (teacher_id, student_id, title, subject, start_time, end_time, location, notes),
      update (student_id, title, subject, start_time, end_time, location, notes),
      delete
  on public.schedules to authenticated;

-- paid_at / marked_by are set by trigger; teacher_id/student_id/month are fixed after creation.
grant insert (student_id, teacher_id, schedule_id, billing_month, amount, status, notes),
      update (status, amount, notes)
  on public.payments to authenticated;

-- payment_history: SELECT only (already granted by Supabase defaults).

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- teachers
-- -----------------------------------------------------------------------------
create policy teachers_select on public.teachers
  for select to authenticated
  using ((select private.is_admin()) or profile_id = (select auth.uid()));

create policy teachers_admin_insert on public.teachers
  for insert to authenticated
  with check ((select private.is_admin()));

create policy teachers_admin_update on public.teachers
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy teachers_admin_delete on public.teachers
  for delete to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- students
-- -----------------------------------------------------------------------------
create policy students_select on public.students
  for select to authenticated
  using ((select private.is_admin()) or private.is_assigned_to_me(id));

create policy students_admin_insert on public.students
  for insert to authenticated
  with check ((select private.is_admin()));

create policy students_admin_update on public.students
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy students_admin_delete on public.students
  for delete to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- teacher_students
-- -----------------------------------------------------------------------------
create policy teacher_students_select on public.teacher_students
  for select to authenticated
  using ((select private.is_admin()) or teacher_id = (select private.current_teacher_id()));

create policy teacher_students_admin_insert on public.teacher_students
  for insert to authenticated
  with check ((select private.is_admin()));

create policy teacher_students_admin_delete on public.teacher_students
  for delete to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- schedules: admin read-only; teachers manage their own, for assigned students only.
-- current_teacher_id() is NULL for admins, so `teacher_id = NULL` is never true for them.
-- -----------------------------------------------------------------------------
create policy schedules_select on public.schedules
  for select to authenticated
  using ((select private.is_admin()) or teacher_id = (select private.current_teacher_id()));

create policy schedules_teacher_insert on public.schedules
  for insert to authenticated
  with check (
    teacher_id = (select private.current_teacher_id())
    and private.is_assigned_to_me(student_id)
  );

create policy schedules_teacher_update on public.schedules
  for update to authenticated
  using (teacher_id = (select private.current_teacher_id()))
  with check (
    teacher_id = (select private.current_teacher_id())
    and private.is_assigned_to_me(student_id)
  );

create policy schedules_teacher_delete on public.schedules
  for delete to authenticated
  using (teacher_id = (select private.current_teacher_id()));

-- -----------------------------------------------------------------------------
-- payments: admin read-only; teachers manage records for their assigned students. No deletes.
-- -----------------------------------------------------------------------------
create policy payments_select on public.payments
  for select to authenticated
  using ((select private.is_admin()) or teacher_id = (select private.current_teacher_id()));

create policy payments_teacher_insert on public.payments
  for insert to authenticated
  with check (
    teacher_id = (select private.current_teacher_id())
    and private.is_assigned_to_me(student_id)
  );

create policy payments_teacher_update on public.payments
  for update to authenticated
  using (
    teacher_id = (select private.current_teacher_id())
    and private.is_assigned_to_me(student_id)
  )
  with check (
    teacher_id = (select private.current_teacher_id())
    and private.is_assigned_to_me(student_id)
  );

-- -----------------------------------------------------------------------------
-- payment_history: visible to whoever can see the parent payment (the subquery runs under
-- payments' own RLS, so no extra rule is needed).
-- -----------------------------------------------------------------------------
create policy payment_history_select on public.payment_history
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.payments p where p.id = payment_id)
  );
