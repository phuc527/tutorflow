# Student role and admin-managed account roles

Date: 2026-09-30 · Status: awaiting review

## Goal

Give students (and parents) their own read-only login, and make the admin the only person who decides
what each login is. Every new login starts as a **student**; the admin can switch accounts between
student and teacher from a new **Users** page. The owner stays the only admin.

### Decisions already made

| Question | Decision |
|---|---|
| Who may sign up? | Only emails already in the system: a teacher record that isn't inactive, or any student record |
| How is a student login tied to student records? | Automatically by confirmed email, to **every** student with that email (a parent with two children sees both). The admin can remove or add links |
| What does a student see? | Read-only: their classes (subject, title, time, location, teacher's name) and monthly fees (amount, paid/unpaid). Never hourly rates, teacher contact details, internal notes or other students |
| Who can grant admin? | Nobody from the app. Admin is granted only with SQL |

## Roles after this change

| Role | How an account gets it | Can |
|---|---|---|
| admin | SQL only | Everything it can today, plus the Users page: switch other non-admin accounts between student and teacher, remove/add student links |
| teacher | Admin sets it on the Users page | Unchanged |
| student | Default for every new login | Read own classes and fees through dedicated functions only |

## Database — migration `20260930001000_student_role.sql`

### Role column
- `profiles.role` check becomes `('admin', 'teacher', 'student')`, default `'student'`.
- `private.handle_new_user()` inserts `'student'` (still never reads a role from sign-up metadata).
- Existing profiles keep their role.

### `public.student_accounts`
```
profile_id  uuid  not null  references profiles(id) on delete cascade
student_id  uuid  not null  references students(id) on delete cascade
linked_at   timestamptz not null default now()
primary key (profile_id, student_id)
index on (student_id)
```
- RLS enabled. `select` for admins only. No insert/update/delete grants: rows are written only by
  triggers and admin RPCs.

### Automatic linking (`private.link_student_accounts_for_user(p_user_id)`, SECURITY DEFINER)
Inserts `(user, student)` for every student whose `lower(email)` equals the user's email, **only if**
the email is confirmed and the profile's role is `student`. `on conflict do nothing`. Called:
1. from `handle_new_user` (auto-confirmed users) and `handle_user_confirmed` (next to the existing
   teacher linking);
2. from a new `AFTER INSERT OR UPDATE OF email` trigger on `students`, for every confirmed
   student-role login with the new email;
3. from `set_user_role` when an account becomes a student.

A link the admin removed comes back only on one of those events. That is intended.

### Sign-up gate
`private.enforce_signup_allowlist()` is replaced: a new login is accepted when its email matches a
non-inactive teacher **or any student** (case-insensitive). The "no admin exists yet" bootstrap
exception stays.

### Changing roles — `public.set_user_role(p_user_id uuid, p_role text)` (SECURITY DEFINER)
- Caller must be admin (`42501` otherwise).
- `p_role` must be `student` or `teacher` (`22023`), so the app can never create an admin.
- Refuses the caller's own account and any account that is currently admin (`42501`).
- Sets a transaction-local flag `set_config('tutorflow.role_change', 'on', true)`, updates the role,
  then:
  - → teacher: delete the account's `student_accounts` rows; run `link_teacher_for_user`.
  - → student: unlink any teacher record (`teachers.profile_id = null`); run
    `link_student_accounts_for_user`.
- `private.guard_profile_update()` allows a role change from an API session only when that flag is
  `'on'`. Clients cannot set it: `set_config` isn't callable through the API and no other exposed
  function sets it. The column grant on `role` stays revoked.

### Admin link management
- `public.unlink_student_account(p_profile_id, p_student_id)` and
  `public.link_student_account(p_profile_id, p_student_id)`: SECURITY DEFINER, admin only; linking
  requires the target to be a student-role account.

### Student data — read-only functions (SECURITY DEFINER, STABLE)
All return rows only for students linked to the caller **and** only when the caller's role is
`student`; for anyone else they return nothing. Existing table policies are untouched, so a student
still reads nothing from any table directly.
- `public.my_students()` → `id, full_name, grade, status`
- `public.my_schedule(p_from timestamptz, p_to timestamptz)` → `id, student_id, student_name, title,
  subject, start_time, end_time, location, teacher_name`. Range must be positive and at most 100 days
  (`22023`).
- `public.my_payments()` → `id, student_id, student_name, teacher_name, billing_month, amount, status,
  paid_at`, newest month first.

All new public functions: `revoke execute from public, anon; grant execute to authenticated`.

## Frontend

### Roles, permissions, navigation, routes
- `ROLES.STUDENT`; permissions `MANAGE_USERS` (admin) and `VIEW_OWN_RECORDS` (student).
- Navigation: admin gains **Users** (`/users`); student sees only **My classes** (`/my/classes`) and
  **My fees** (`/my/fees`); existing entries lose nothing for admin/teacher and are hidden from students.
- Router: existing pages (dashboard, students, schedules, payments) move under
  `RequireRole([admin, teacher])`; `/my/*` under `RequireRole([student])`; `/users` under
  `RequireRole([admin])`. The index route redirects by role (student → `/my/classes`, others →
  `/dashboard`); `GuestOnly` sends a signed-in user to the same place.

### Pages
- **UsersPage** (admin): table of accounts — name, email, role badge, what it's linked to (teacher
  record or student names). A role select (Student / Teacher) on non-admin rows other than the
  caller's; admin rows are read-only. A linked student can be removed; a student can be added from a
  picker. Uses `usersService` (list via `profiles` with embeds, `set_user_role`, link/unlink RPCs).
- **MyClassesPage** (student): classes for the selected month (reusing `MonthSwitcher`), grouped by
  day, each with time, subject, title, location, teacher; the student's name is shown when more than
  one student is linked.
- **MyFeesPage** (student): one row per student and month — month, teacher, amount, Paid/Unpaid badge
  and paid date.
- Both student pages show "Your account isn't linked to a student yet. Contact your tutoring center."
  when `my_students()` is empty.
- `studentPortalService` wraps the three RPCs.
- Sign-up copy: open to students, parents and teachers whose email the center has on file.
- `errors.js`: messages for the new refusal reasons.

## Onboarding after the change
- Student/parent: admin records the student with an email → they sign up → confirm → linked.
- Teacher: admin adds the teacher record → teacher signs up (becomes a student with no links) →
  admin switches them to **Teacher** on the Users page → linked to the teacher record.

## Testing
- PGlite (`supabase/tests/rls.test.mjs`): default role; sign-up gate for teacher/student/unknown
  emails; auto-linking on confirm, on student insert and on email change, including one parent → two
  students; `set_user_role` refusals (non-admin, self, admin target, `admin` value) and effects
  (links added/removed both ways); the guard still blocks direct role updates; students read nothing
  from any table; `my_*` return only linked data, nothing for teachers/admins, and reject bad ranges;
  link/unlink RPCs admin-only. All existing tests stay green.
- Vitest: permissions and navigation per role; role-based home redirect; UsersPage role change and
  locked admin rows; student pages render data and the not-linked state.

## Rollout
1. The owner must already be admin (SQL) before the migration reaches production; otherwise the
   bootstrap exception keeps sign-up open to every email.
2. `npm run check` → apply migration 0010 via MCP → verify structure and advisors → commit and push →
   Vercel deploys → verify production.

## Out of scope
Inviting accounts by email, creating admins from the app, a student dashboard, students editing
anything.
