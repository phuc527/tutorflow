-- =============================================================================
-- TutorFlow 0001: tables, constraints, indexes
-- =============================================================================
-- Conventions:
--   * UUID primary keys (gen_random_uuid) so ids can't be guessed or enumerated.
--   * text + CHECK constraints for small value sets (easier to evolve than enums).
--   * timestamptz everywhere: absolute instants; the UI renders them in Asia/Ho_Chi_Minh.
--   * Validation lives here too, not only in the React forms: the database is the last line of defence.

-- btree_gist lets a GiST index combine "=" on a uuid with "&&" (overlaps) on a time range.
-- That powers the no-overlap EXCLUDE constraints on schedules.
create extension if not exists btree_gist with schema extensions;

-- Private schema for helper functions. Supabase only exposes `public` over the API,
-- so nothing in `private` can be called directly by clients.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: one row per login (auth.users). Holds the authoritative role.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  role        text not null default 'teacher' check (role in ('admin', 'teacher')),
  phone       text check (phone is null or phone ~ '^[0-9+() .-]{8,20}$'),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- teachers: HR-style record managed by the admin. profile_id links it to a login
-- (null until the teacher is given an account).
-- -----------------------------------------------------------------------------
create table public.teachers (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid unique references public.profiles (id) on delete set null,
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 120),
  email           text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone           text check (phone is null or phone ~ '^[0-9+() .-]{8,20}$'),
  specialization  text check (specialization is null or char_length(specialization) <= 120),
  hourly_rate     numeric(12, 0) not null default 0 check (hourly_rate >= 0),
  status          text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index teachers_email_key on public.teachers (lower(email));
create index teachers_status_idx on public.teachers (status);

-- -----------------------------------------------------------------------------
-- students
-- -----------------------------------------------------------------------------
create table public.students (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (char_length(btrim(full_name)) between 2 and 120),
  -- Not unique: siblings often share a parent's email.
  email         text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone         text check (phone is null or phone ~ '^[0-9+() .-]{8,20}$'),
  parent_name   text check (parent_name is null or char_length(parent_name) <= 120),
  parent_phone  text check (parent_phone is null or parent_phone ~ '^[0-9+() .-]{8,20}$'),
  grade         smallint check (grade between 1 and 12), -- Vietnamese school grades 1–12
  status        text not null default 'active' check (status in ('active', 'inactive')),
  notes         text check (notes is null or char_length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index students_status_idx on public.students (status);
create index students_grade_idx on public.students (grade);

-- -----------------------------------------------------------------------------
-- teacher_students: many-to-many assignment (a student can have several teachers).
-- -----------------------------------------------------------------------------
create table public.teacher_students (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.teachers (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  constraint teacher_students_unique unique (teacher_id, student_id)
);
-- The unique constraint already indexes (teacher_id, …); add the reverse lookup.
create index teacher_students_student_idx on public.teacher_students (student_id);

-- -----------------------------------------------------------------------------
-- schedules: one class session between one teacher and one student.
-- -----------------------------------------------------------------------------
create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  subject     text not null check (char_length(btrim(subject)) between 1 and 80),
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  location    text check (location is null or char_length(location) <= 120),
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_by  uuid references public.profiles (id) on delete set null, -- set by trigger, not the client
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint schedules_time_order check (end_time > start_time),
  constraint schedules_max_duration check (end_time - start_time <= interval '12 hours'),

  -- No two sessions of the same teacher may overlap, nor two of the same student.
  -- '[)' = start inclusive, end exclusive, so back-to-back classes (10:00–11:00, 11:00–12:00) are allowed.
  -- Exclusion constraints are checked atomically by the index, so two concurrent requests can't both
  -- slip through (unlike "SELECT to check, then INSERT" in application code).
  constraint schedules_no_teacher_overlap
    exclude using gist (teacher_id with =, tstzrange(start_time, end_time, '[)') with &&),
  constraint schedules_no_student_overlap
    exclude using gist (student_id with =, tstzrange(start_time, end_time, '[)') with &&)
);
create index schedules_teacher_start_idx on public.schedules (teacher_id, start_time);
create index schedules_student_start_idx on public.schedules (student_id, start_time);
create index schedules_start_idx on public.schedules (start_time);

-- -----------------------------------------------------------------------------
-- payments: manual monthly paid/unpaid status per (student, teacher, month).
-- -----------------------------------------------------------------------------
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT: financial records must survive; deactivate a teacher/student instead of deleting.
  student_id     uuid not null references public.students (id) on delete restrict,
  teacher_id     uuid not null references public.teachers (id) on delete restrict,
  schedule_id    uuid references public.schedules (id) on delete set null,
  billing_month  date not null check (billing_month = date_trunc('month', billing_month)::date),
  amount         numeric(12, 0) not null default 0 check (amount >= 0),
  status         text not null default 'unpaid' check (status in ('paid', 'unpaid')),
  paid_at        timestamptz,  -- set by trigger
  marked_by      uuid references public.profiles (id) on delete set null, -- set by trigger
  notes          text check (notes is null or char_length(notes) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Business rules 11 & 12: paid ⇔ paid_at present.
  constraint payments_paid_at_matches_status check ((status = 'paid') = (paid_at is not null)),
  constraint payments_one_per_month unique (student_id, teacher_id, billing_month)
);
create index payments_teacher_month_idx on public.payments (teacher_id, billing_month);
create index payments_month_status_idx on public.payments (billing_month, status);

-- -----------------------------------------------------------------------------
-- payment_history: append-only audit trail, written only by a trigger.
-- -----------------------------------------------------------------------------
create table public.payment_history (
  id          bigint generated always as identity primary key,
  payment_id  uuid not null references public.payments (id) on delete cascade,
  old_status  text check (old_status in ('paid', 'unpaid')),
  new_status  text not null check (new_status in ('paid', 'unpaid')),
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index payment_history_payment_idx on public.payment_history (payment_id, changed_at desc);

-- updated_at maintenance
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger teachers_updated_at before update on public.teachers
  for each row execute function private.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute function private.set_updated_at();
create trigger schedules_updated_at before update on public.schedules
  for each row execute function private.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
