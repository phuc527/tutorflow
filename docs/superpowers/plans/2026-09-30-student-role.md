# Student Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `student` role (default for new logins), auto-linked to student records by confirmed email, and let the admin switch accounts between student and teacher from a Users page.

**Architecture:** One migration (`20260930001000_student_role.sql`, built up across Tasks 1–3) adds the role value, a `student_accounts` link table, linking triggers, a wider sign-up gate, admin RPCs (`set_user_role`, `link_student_account`, `unlink_student_account`) and three SECURITY DEFINER read functions (`my_students`, `my_schedule`, `my_payments`). Existing table policies are not touched, so students can read no table directly. The React app gets a role-aware home redirect, a Users page for the admin and two student pages.

**Tech Stack:** Postgres/Supabase (RLS, plpgsql), PGlite + `node:test` for DB tests, React 19, React Router 8, TanStack Query 5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-30-student-role-design.md`

## Global Constraints

- Role values: exactly `'admin'`, `'teacher'`, `'student'`; column default `'student'`.
- The app can never grant `admin`: `set_user_role` accepts only `'student'` or `'teacher'`.
- `set_user_role` refuses the caller's own account and any current admin account.
- Students read nothing from any table directly; only `my_students()`, `my_schedule(p_from, p_to)`, `my_payments()`.
- `my_schedule` range: `p_to > p_from` and `p_to - p_from <= interval '100 days'`, else SQLSTATE `22023`.
- Student-visible columns only: subject, title, times, location, teacher **name**, student name, month, amount, status, paid date. Never `hourly_rate`, teacher email/phone, notes.
- Every new function: `set search_path = ''`, fully-qualified names; public ones `revoke execute … from public, anon; grant execute … to authenticated`; private ones revoked from `public, anon, authenticated`.
- Sign-up gate: email must match a non-inactive teacher or any student (case-insensitive); open while no admin exists.
- Commands: `npm run test:db` (PGlite), `npx vitest run <path>`, `npm run check` (lint + unit + DB + build).
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A student's email is corrected by the admin** → the login that matched the *old* email must lose access to that student (otherwise a mistyped email leaks a child's data to the wrong parent). Covered in Task 1 (`email change moves the link`).
2. **An account switched teacher → student** keeps no access to its old teacher record (teacher record unlinked, `current_teacher_id()` null). Covered in Task 2.
3. **A student-role login calling `my_*` when it has no links** gets empty results, not an error, and the UI shows the not-linked state. Covered in Tasks 3 and 6.
4. **A teacher or admin calling `my_schedule`** gets nothing (not every schedule). Covered in Task 3.
5. **A direct `update profiles set role` from an API session** is still refused after the guard change (the flag cannot be set by clients). Covered in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260930001000_student_role.sql` (create) | All DB changes, appended section by section in Tasks 1–3 |
| `supabase/tests/rls.test.mjs` (modify) | Setup adjustments + three new `describe` blocks |
| `src/constants/roles.js`, `permissions.js`, `navigation.js`, `queryKeys.js` (modify) | Student role, new permissions, nav items, `homePathForRole`, query keys |
| `src/features/auth/components/RouteGuards.jsx` (modify) | `HomeRedirect`; `GuestOnly` sends users to `/` |
| `src/app/router.jsx` (modify) | Role-guarded route groups, `/users`, `/my/classes`, `/my/fees` |
| `src/components/common/StatusBadge.jsx` (modify) | `student` badge |
| `src/services/usersService.js` (create) | Profiles list + role/link RPCs |
| `src/features/users/hooks.js`, `pages/UsersPage.jsx` (create) | Admin Users page |
| `src/services/portalService.js` (create) | `my_*` RPC wrappers |
| `src/features/portal/hooks.js`, `components/NotLinkedState.jsx`, `pages/MyClassesPage.jsx`, `pages/MyFeesPage.jsx` (create) | Student pages |
| `src/services/errors.js`, `src/features/auth/pages/SignupPage.jsx`, `README.md` (modify) | Messages, sign-up copy, docs |

---

### Task 1: Student role default, link table, auto-linking and sign-up gate

**Files:**
- Create: `supabase/migrations/20260930001000_student_role.sql`
- Modify: `supabase/tests/rls.test.mjs` (setup in `before`, test `new login gets a teacher profile…`, test `[SEC-1] an UNCONFIRMED sign-up…`, new `describe('student accounts')`)

**Interfaces:**
- Produces: table `public.student_accounts(profile_id uuid, student_id uuid, linked_at timestamptz)`; `private.link_student_accounts_for_user(p_user_id uuid) returns void`; trigger `students_link_accounts`; replaced `private.enforce_signup_allowlist()`, `private.handle_new_user()`, `private.handle_user_confirmed()`.

- [ ] **Step 1: Adapt the test setup to the new default role**

In `before(...)`, after the `insert into auth.users …` statement, add (the fixed logins t1, t2, stray are teacher logins in every existing test):

```js
  // Since migration 0010 every new login is a student. The fixed teacher logins are switched to
  // teacher the way an admin would, then linked (link_teacher_for_user only links teacher-role logins).
  await db.query(`update public.profiles set role = 'teacher' where id = any($1::uuid[])`, [[U.t1, U.t2, U.stray]])
  await db.query(`select private.link_teacher_for_user(id) from public.profiles where id = any($1::uuid[])`, [[U.t1, U.t2, U.stray]])
```

Change the first test in `describe('sign-up and roles')`:

```js
  test('new login gets a student profile; role in sign-up metadata is ignored', () =>
    tx(async ({ q }) => {
      const [p] = await q(`select role, full_name from public.profiles where id = $1`, [U.admin])
      assert.equal(p.role, 'student')
      assert.equal(p.full_name, 'Owner')
    }))
```

In `[SEC-1] an UNCONFIRMED sign-up with a teacher’s email…`, replace the last three lines (the confirmation block) with:

```js
      // Confirming makes it a student login; only an admin switching it to teacher links the record (Task 2).
      await as(SUPER)
      await run(`update auth.users set email_confirmed_at = now() where id = $1`, [ATTACKER])
      assert.equal((await q(`select profile_id from public.teachers where id = $1`, [T3]))[0].profile_id, null)
```

- [ ] **Step 2: Write the failing student-account tests**

Append to `supabase/tests/rls.test.mjs`:

```js
// =============================================================================
describe('student accounts', () => {
  const STU = 'dddddddd-0000-4000-8000-000000000001' // lan.vo@example.com (student S2)
  const signUpStudent = (email = 'lan.vo@example.com', confirmed = true) => [
    `insert into auth.users (id, email, email_confirmed_at) values ($1, $2, ${confirmed ? 'now()' : 'null'})`,
    [STU, email],
  ]
  const links = (q) => q(`select student_id from public.student_accounts where profile_id = $1 order by student_id`, [STU])

  test('a confirmed login is linked to the student with its email', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent('LAN.VO@example.com'))
      assert.deepEqual((await links(q)).map((r) => r.student_id), [S(2)])
    }))

  test('an unconfirmed login is linked only once it confirms', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent('lan.vo@example.com', false))
      assert.equal((await links(q)).length, 0)
      await run(`update auth.users set email_confirmed_at = now() where id = $1`, [STU])
      assert.equal((await links(q)).length, 1)
    }))

  test('a parent login is linked to every child sharing the email, including ones added later', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent())
      await run(`update public.students set email = 'lan.vo@example.com' where id = $1`, [S(3)])
      assert.deepEqual((await links(q)).map((r) => r.student_id), [S(2), S(3)])
    }))

  test('email change moves the link: the old login loses the student', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent())
      await run(`update public.students set email = 'someone.else@example.com' where id = $1`, [S(2)])
      assert.equal((await links(q)).length, 0)
    }))

  test('teacher logins are never linked to students', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`update public.students set email = 'teacher1@example.com' where id = $1`, [S(4)])
      assert.equal((await q(`select 1 from public.student_accounts where profile_id = $1`, [U.t1])).length, 0)
    }))

  test('once an admin exists, a student email may sign up and an unknown one may not', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await run(...signUpStudent('lan.vo@example.com', false))
      await rejects(run(`insert into auth.users (id, email) values (gen_random_uuid(), 'nobody@example.com')`), '42501')
    }))

  test('only admins can read student links; students and teachers cannot', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent())
      await promoteAdmin(as, run)
      await as(U.admin)
      assert.equal((await q(`select * from public.student_accounts`)).length, 1)
      await as(STU)
      assert.equal((await q(`select * from public.student_accounts`)).length, 0)
      await as(U.t2)
      assert.equal((await q(`select * from public.student_accounts`)).length, 0)
      await rejects(run(`insert into public.student_accounts (profile_id, student_id) values ($1, $2)`, [U.t2, S(1)]), '42501')
    }))

  test('a student login reads nothing from the regular tables', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(...signUpStudent())
      await as(STU)
      for (const table of ['teachers', 'students', 'teacher_students', 'schedules', 'payments', 'payment_history']) {
        assert.equal((await q(`select * from public.${table}`)).length, 0, table)
      }
    }))
})
```

- [ ] **Step 3: Run the DB tests to verify they fail**

Run: `npm run test:db`
Expected: `new login gets a student profile…` fails (`'teacher' !== 'student'`), and every `student accounts` test fails with `relation "public.student_accounts" does not exist`. The other existing tests still pass (the setup lines are harmless before the migration).

- [ ] **Step 4: Create the migration with the first section**

Create `supabase/migrations/20260930001000_student_role.sql`:

```sql
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
```

- [ ] **Step 5: Run the DB tests to verify they pass**

Run: `npm run test:db`
Expected: `# fail 0` (all earlier tests plus the 8 new `student accounts` tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260930001000_student_role.sql supabase/tests/rls.test.mjs
git commit -m "DB: student role default, student_accounts and auto-linking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Admin role changes and manual student links

**Files:**
- Modify: `supabase/migrations/20260930001000_student_role.sql` (append)
- Modify: `supabase/tests/rls.test.mjs` (append `describe('role management')`)

**Interfaces:**
- Consumes: `private.link_student_accounts_for_user(uuid)` (Task 1), `private.link_teacher_for_user(uuid)` (0007), `private.is_admin()`.
- Produces: `public.set_user_role(p_user_id uuid, p_role text) returns void`; `public.link_student_account(p_profile_id uuid, p_student_id uuid) returns void`; `public.unlink_student_account(p_profile_id uuid, p_student_id uuid) returns void`. Error `detail` values: `role_invalid`, `role_self`, `role_admin_target`, `link_not_student`.

- [ ] **Step 1: Write the failing tests**

Append:

```js
// =============================================================================
describe('role management', () => {
  const NEWBIE = 'eeeeeeee-0000-4000-8000-000000000001'
  const setRole = (id, role) => [`select public.set_user_role($1, $2)`, [id, role]]
  const roleOf = async (q, id) => (await q(`select role from public.profiles where id = $1`, [id]))[0].role

  test('admin switches a confirmed student login to teacher; it gets linked to its teacher record', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'teacher3@example.com', now())`, [NEWBIE])
      await promoteAdmin(as, run)
      await as(U.admin)
      await run(...setRole(NEWBIE, 'teacher'))
      await as(SUPER)
      assert.equal(await roleOf(q, NEWBIE), 'teacher')
      const T3 = '11111111-1111-4111-8111-000000000003'
      assert.equal((await q(`select profile_id from public.teachers where id = $1`, [T3]))[0].profile_id, NEWBIE)
    }))

  test('switching a teacher to student unlinks the teacher record and removes access', () =>
    tx(async ({ as, q, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await run(...setRole(U.t1, 'student'))
      await as(SUPER)
      assert.equal((await q(`select profile_id from public.teachers where id = $1`, [T1]))[0].profile_id, null)
      await as(U.t1)
      assert.equal((await q(`select id from public.schedules`)).length, 0)
      assert.equal((await q(`select id from public.students`)).length, 0)
    }))

  test('switching a student to teacher removes its student links', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'lan.vo@example.com', now())`, [NEWBIE])
      await promoteAdmin(as, run)
      await as(U.admin)
      await run(...setRole(NEWBIE, 'teacher'))
      assert.equal((await q(`select 1 from public.student_accounts where profile_id = $1`, [NEWBIE])).length, 0)
    }))

  test('only an admin may change roles', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(...setRole(U.t2, 'student')), '42501')
    }))

  test('the app can never grant admin, change its own role or touch another admin', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(SUPER)
      await run(`update public.profiles set role = 'admin' where id = $1`, [U.t2])
      await as(U.admin)
      await rejects(run(...setRole(U.t1, 'admin')), '22023')
      await rejects(run(...setRole(U.admin, 'teacher')), '42501')
      await rejects(run(...setRole(U.t2, 'student')), '42501')
    }))

  test('a direct role update from the API is still refused', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(`update public.profiles set role = 'student' where id = $1`, [U.stray]), '42501')
      // A client that sets the flag itself is still refused: the token must exist in a private table
      // that only set_user_role writes to, inside its own transaction.
      await run(`select set_config('tutorflow.role_change', gen_random_uuid()::text, true)`)
      await rejects(run(`update public.profiles set role = 'student' where id = $1`, [U.stray]), '42501')
    }))

  test('admin can link and unlink a student login; others cannot; teachers cannot be linked', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'lan.vo@example.com', now())`, [NEWBIE])
      await promoteAdmin(as, run)
      await as(U.admin)
      await run(`select public.link_student_account($1, $2)`, [NEWBIE, S(5)])
      await run(`select public.unlink_student_account($1, $2)`, [NEWBIE, S(2)])
      assert.deepEqual((await q(`select student_id from public.student_accounts where profile_id = $1`, [NEWBIE])).map((r) => r.student_id), [S(5)])
      await rejects(run(`select public.link_student_account($1, $2)`, [U.t1, S(5)]), '22023')
      await as(U.t1)
      await rejects(run(`select public.link_student_account($1, $2)`, [NEWBIE, S(1)]), '42501')
      await rejects(run(`select public.unlink_student_account($1, $2)`, [NEWBIE, S(5)]), '42501')
    }))
})
```

- [ ] **Step 2: Run the DB tests to verify they fail**

Run: `npm run test:db`
Expected: the `role management` tests fail with `function public.set_user_role(uuid, text) does not exist`.

- [ ] **Step 3: Append the role-management section to the migration**

The guard must not trust a flag a client could set with `set_config` (any SQL session may set a custom setting). So the flag holds a per-call random token that `set_user_role` also stores in a private table only it can write, and deletes before returning; the guard requires both. This tightens the spec's plain `'on'` flag; behaviour is otherwise as specified.

```sql
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
```

- [ ] **Step 4: Run the DB tests to verify they pass**

Run: `npm run test:db`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260930001000_student_role.sql supabase/tests/rls.test.mjs
git commit -m "DB: admin-only role changes and student link management

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Student read functions

**Files:**
- Modify: `supabase/migrations/20260930001000_student_role.sql` (append)
- Modify: `supabase/tests/rls.test.mjs` (append `describe('student portal functions')`)

**Interfaces:**
- Produces:
  - `public.my_students() returns table (id uuid, full_name text, grade smallint, status text)`
  - `public.my_schedule(p_from timestamptz, p_to timestamptz) returns table (id uuid, student_id uuid, student_name text, title text, subject text, start_time timestamptz, end_time timestamptz, location text, teacher_name text)`
  - `public.my_payments() returns table (id uuid, student_id uuid, student_name text, teacher_name text, billing_month date, amount numeric, status text, paid_at timestamptz)`

- [ ] **Step 1: Write the failing tests**

Append:

```js
// =============================================================================
describe('student portal functions', () => {
  const STU = 'ffffffff-0000-4000-8000-000000000001'
  async function studentWithData({ as, run }) {
    await as(SUPER)
    await run(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'lan.vo@example.com', now())`, [STU])
    // T2 teaches S2 (lan.vo) and S4. One class and one payment each.
    await run(...schedule(T2, S(2), '2026-10-05T02:00:00Z', '2026-10-05T03:00:00Z'))
    await run(...schedule(T2, S(4), '2026-10-05T04:00:00Z', '2026-10-05T05:00:00Z'))
    await run(`insert into public.payments (student_id, teacher_id, billing_month, amount) values ($1, $2, '2026-10-01', 500000), ($3, $2, '2026-10-01', 700000)`, [S(2), T2, S(4)])
  }

  test('a student sees only their own classes, with the teacher name but no teacher details', () =>
    tx(async (ctx) => {
      await studentWithData(ctx)
      await ctx.as(STU)
      const rows = await ctx.q(`select * from public.my_schedule('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')`)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].student_id, S(2))
      assert.equal(rows[0].teacher_name, 'Trần Thị Bình')
      assert.deepEqual(Object.keys(rows[0]).sort(), ['end_time', 'id', 'location', 'start_time', 'student_id', 'student_name', 'subject', 'teacher_name', 'title'])
    }))

  test('a student sees only their own fees and students', () =>
    tx(async (ctx) => {
      await studentWithData(ctx)
      await ctx.as(STU)
      const fees = await ctx.q(`select * from public.my_payments()`)
      assert.deepEqual(fees.map((f) => [f.student_id, Number(f.amount), f.status]), [[S(2), 500000, 'unpaid']])
      assert.deepEqual((await ctx.q(`select id from public.my_students()`)).map((r) => r.id), [S(2)])
    }))

  test('teachers and admins get nothing from the student functions', () =>
    tx(async (ctx) => {
      await studentWithData(ctx)
      await promoteAdmin(ctx.as, ctx.run)
      for (const who of [U.t2, U.admin]) {
        await ctx.as(who)
        assert.equal((await ctx.q(`select * from public.my_schedule('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')`)).length, 0)
        assert.equal((await ctx.q(`select * from public.my_payments()`)).length, 0)
        assert.equal((await ctx.q(`select * from public.my_students()`)).length, 0)
      }
    }))

  test('a student with no links gets empty results, not an error', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'orphan@example.com', now())`, [STU])
      await as(STU)
      assert.equal((await q(`select * from public.my_students()`)).length, 0)
      assert.equal((await q(`select * from public.my_payments()`)).length, 0)
    }))

  test('my_schedule rejects empty, reversed or over-long ranges', () =>
    tx(async (ctx) => {
      await studentWithData(ctx)
      await ctx.as(STU)
      await rejects(ctx.run(`select * from public.my_schedule('2026-10-02T00:00:00Z', '2026-10-01T00:00:00Z')`), '22023')
      await rejects(ctx.run(`select * from public.my_schedule('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')`), '22023')
      await rejects(ctx.run(`select * from public.my_schedule(null, '2026-06-01T00:00:00Z')`), '22023')
    }))

  test('anonymous visitors cannot call the student functions', () =>
    tx(async ({ as, run }) => {
      await as(null)
      await rejects(run(`select * from public.my_payments()`), '42501')
    }))
})
```

- [ ] **Step 2: Run the DB tests to verify they fail**

Run: `npm run test:db`
Expected: `function public.my_schedule(unknown, unknown) does not exist` and similar.

- [ ] **Step 3: Append the read functions to the migration**

```sql
-- -----------------------------------------------------------------------------
-- Student read-only access. Only these functions expose data to students; each returns rows for
-- the caller's linked students, and nothing unless the caller's role is 'student'.
-- -----------------------------------------------------------------------------
create or replace function private.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sa.student_id
  from public.student_accounts sa
  join public.profiles p on p.id = sa.profile_id
  where sa.profile_id = (select auth.uid())
    and p.role = 'student';
$$;
revoke execute on function private.my_student_ids() from public, anon, authenticated;

create or replace function public.my_students()
returns table (id uuid, full_name text, grade smallint, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.grade, s.status
  from public.students s
  where s.id in (select private.my_student_ids())
  order by s.full_name;
$$;

create or replace function public.my_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, student_id uuid, student_name text, title text, subject text,
  start_time timestamptz, end_time timestamptz, location text, teacher_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '100 days' then
    raise exception 'Choose a date range of at most 100 days' using errcode = '22023', detail = 'range_invalid';
  end if;
  return query
    select sc.id, sc.student_id, st.full_name, sc.title, sc.subject,
           sc.start_time, sc.end_time, sc.location, t.full_name
    from public.schedules sc
    join public.students st on st.id = sc.student_id
    join public.teachers t on t.id = sc.teacher_id
    where sc.student_id in (select private.my_student_ids())
      and sc.start_time < p_to
      and sc.end_time > p_from
    order by sc.start_time;
end;
$$;

create or replace function public.my_payments()
returns table (
  id uuid, student_id uuid, student_name text, teacher_name text,
  billing_month date, amount numeric, status text, paid_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.student_id, st.full_name, t.full_name, p.billing_month, p.amount, p.status, p.paid_at
  from public.payments p
  join public.students st on st.id = p.student_id
  join public.teachers t on t.id = p.teacher_id
  where p.student_id in (select private.my_student_ids())
  order by p.billing_month desc, st.full_name, t.full_name;
$$;

revoke execute on function
  public.my_students(),
  public.my_schedule(timestamptz, timestamptz),
  public.my_payments()
from public, anon;
grant execute on function
  public.my_students(),
  public.my_schedule(timestamptz, timestamptz),
  public.my_payments()
to authenticated;

-- Keep private helpers off the API roles (functions added in this migration included).
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.current_user_role(),
  private.is_admin(),
  private.current_teacher_id(),
  private.is_assigned_to_me(uuid)
to authenticated, service_role;
```

- [ ] **Step 4: Run the DB tests to verify they pass**

Run: `npm run test:db`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260930001000_student_role.sql supabase/tests/rls.test.mjs
git commit -m "DB: read-only student functions for classes, fees and linked students

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Roles, permissions, navigation and role-based routing

**Files:**
- Modify: `src/constants/roles.js`, `src/constants/permissions.js`, `src/constants/navigation.js`, `src/constants/queryKeys.js`, `src/components/common/StatusBadge.jsx`, `src/features/auth/components/RouteGuards.jsx`, `src/app/router.jsx`
- Test: `src/constants/permissions.test.js`, `src/features/auth/components/RouteGuards.test.jsx`

**Interfaces:**
- Produces: `ROLES.STUDENT = 'student'`; `PERMISSIONS.MANAGE_USERS = 'users:manage'`, `PERMISSIONS.VIEW_OWN_RECORDS = 'own:view'`; `homePathForRole(role) → '/my/classes' | '/dashboard'`; `HomeRedirect` component; query keys `queryKeys.users.all = ['users']`, `queryKeys.users.list() = ['users','list']`, `queryKeys.portal.all = ['portal']`, `queryKeys.portal.students() = ['portal','students']`, `queryKeys.portal.schedule(params) = ['portal','schedule',params]`, `queryKeys.portal.payments() = ['portal','payments']`. The `/users` and `/my/*` routes are registered in Tasks 5 and 6, together with the pages they load.

- [ ] **Step 1: Write the failing tests**

In `src/constants/permissions.test.js`, add inside the `describe`:

```js
  test('student only views their own records', () => {
    expect(hasPermission('student', PERMISSIONS.VIEW_OWN_RECORDS)).toBe(true)
    for (const p of [PERMISSIONS.MANAGE_SCHEDULES, PERMISSIONS.MARK_PAYMENTS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.MANAGE_USERS, PERMISSIONS.VIEW_TEACHERS]) {
      expect(hasPermission('student', p)).toBe(false)
    }
    expect(hasPermission('admin', PERMISSIONS.MANAGE_USERS)).toBe(true)
    expect(hasPermission('teacher', PERMISSIONS.MANAGE_USERS)).toBe(false)
  })

  test('home page per role', () => {
    expect(homePathForRole('student')).toBe('/my/classes')
    expect(homePathForRole('admin')).toBe('/dashboard')
    expect(homePathForRole('teacher')).toBe('/dashboard')
  })
```

Update the import to `import { homePathForRole, navItemsForRole } from './navigation'` and replace the `navigation per role` test body with:

```js
    expect(navItemsForRole('admin').map((i) => i.label)).toEqual(['Dashboard', 'Teachers', 'Students', 'Schedules', 'Payments', 'Users'])
    expect(navItemsForRole('teacher').map((i) => i.label)).toEqual(['Dashboard', 'My Students', 'Schedules', 'Payments'])
    expect(navItemsForRole('student').map((i) => i.label)).toEqual(['My classes', 'My fees'])
```

In `src/features/auth/components/RouteGuards.test.jsx`: import `HomeRedirect` alongside the other guards; in `renderAt`'s route list add, inside the `RequireAuth` children, `{ path: '/', element: <HomeRedirect /> }` and `{ path: '/my/classes', element: <p>my classes page</p> }`; add tests:

```js
  test('the home page sends a student to their classes and staff to the dashboard', async () => {
    renderAt('/', { session, profile: { ...teacher, role: 'student' } })
    expect(await screen.findByText('my classes page')).toBeTruthy()
    cleanup()
    renderAt('/', { session, profile: admin })
    expect(await screen.findByText('dashboard page')).toBeTruthy()
  })

  test('a student opening a staff page is sent to /unauthorized', async () => {
    renderAt('/teachers', { session, profile: { ...teacher, role: 'student' } })
    expect(await screen.findByText('unauthorized page')).toBeTruthy()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/constants src/features/auth`
Expected: FAIL — `homePathForRole is not a function`, `HomeRedirect` undefined, nav labels mismatch.

- [ ] **Step 3: Implement**

`src/constants/roles.js`:

```js
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
})
```

`src/constants/permissions.js` — add to `PERMISSIONS`:

```js
  MANAGE_USERS: 'users:manage',
  VIEW_OWN_RECORDS: 'own:view',
```

and set `ROLE_PERMISSIONS` to:

```js
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_TEACHERS,
    PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.ASSIGN_STUDENTS,
    PERMISSIONS.MANAGE_USERS,
  ],
  [ROLES.TEACHER]: [PERMISSIONS.MANAGE_SCHEDULES, PERMISSIONS.MARK_PAYMENTS],
  [ROLES.STUDENT]: [PERMISSIONS.VIEW_OWN_RECORDS],
}
```

`src/constants/navigation.js` — change the import to `import { CalendarDays, GraduationCap, LayoutDashboard, UserCog, Users, Wallet } from 'lucide-react'`, append to `NAV_ITEMS`:

```js
  { to: '/users', label: 'Users', icon: UserCog, roles: [ROLES.ADMIN] },
  { to: '/my/classes', label: 'My classes', icon: CalendarDays, roles: [ROLES.STUDENT] },
  { to: '/my/fees', label: 'My fees', icon: Wallet, roles: [ROLES.STUDENT] },
```

and add at the end of the file:

```js
/** Where "/" (and a fresh sign-in) takes each role. */
export function homePathForRole(role) {
  return role === ROLES.STUDENT ? '/my/classes' : '/dashboard'
}
```

`src/constants/queryKeys.js` — add:

```js
  users: {
    all: ['users'],
    list: () => ['users', 'list'],
  },
  portal: {
    all: ['portal'],
    students: () => ['portal', 'students'],
    schedule: (params) => ['portal', 'schedule', params],
    payments: () => ['portal', 'payments'],
  },
```

`src/components/common/StatusBadge.jsx` — add `student: { tone: 'neutral', label: 'Student' },` after `teacher`.

`src/features/auth/components/RouteGuards.jsx` — add the import `import { homePathForRole } from '@/constants/navigation'`, and:

```js
/** Index route: each role starts on its own home page. */
export function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={homePathForRole(role)} replace />
}
```

In `GuestOnly`, change the fallback `'/dashboard'` to `'/'` so the redirect goes through `HomeRedirect`.

`src/app/router.jsx` — import `HomeRedirect` with the other guards and restructure the `'/'` children to:

```js
            children: [
              { index: true, element: <HomeRedirect /> },
              {
                element: <RequireRole roles={[ROLES.ADMIN, ROLES.TEACHER]} />,
                children: [
                  { path: 'dashboard', lazy: page(() => import('@/features/dashboard/pages/DashboardPage')), handle: { crumb: 'Dashboard' } },
                  { path: 'students', lazy: page(() => import('@/features/students/pages/StudentsPage')), handle: { crumb: 'Students' } },
                  { path: 'schedules', lazy: page(() => import('@/features/schedules/pages/SchedulesPage')), handle: { crumb: 'Schedules' } },
                  { path: 'payments', lazy: page(() => import('@/features/payments/pages/PaymentsPage')), handle: { crumb: 'Payments' } },
                  {
                    element: <RequireRole roles={[ROLES.ADMIN]} />,
                    children: [
                      { path: 'teachers', lazy: page(() => import('@/features/teachers/pages/TeachersPage')), handle: { crumb: 'Teachers' } },
                    ],
                  },
                ],
              },
            ],
```

Update the route-tree comment: `GuestOnly → /login and /signup are only for logged-out users; "/" redirects by role`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/constants src/features/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants src/components/common/StatusBadge.jsx src/features/auth/components src/app/router.jsx
git commit -m "Student role in the UI: permissions, navigation and role-based home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Admin Users page

**Files:**
- Create: `src/services/usersService.js`, `src/features/users/hooks.js`, `src/features/users/pages/UsersPage.jsx`
- Test: `src/features/users/pages/UsersPage.test.jsx`
- Modify: `src/app/router.jsx` (add `/users`), `src/services/errors.js`

**Interfaces:**
- Consumes: RPCs from Task 2; `queryKeys.users` (Task 4); `studentsService.listOptions()` (existing, returns `[{ id, full_name, grade, status }]`); `useAppMutation`, `DataTable`, `PageHeader`, `StatusBadge`, `NativeSelect`, `Button`.
- Produces: `usersService.list() → [{ id, email, full_name, role, created_at, teacher: { id, full_name } | null, studentLinks: [{ student: { id, full_name } }] }]`, `usersService.setRole(userId, role)`, `usersService.linkStudent(profileId, studentId)`, `usersService.unlinkStudent(profileId, studentId)`.

- [ ] **Step 1: Write the failing test**

`src/features/users/pages/UsersPage.test.jsx`:

```jsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/features/auth/authContext'
import { usersService } from '@/services/usersService'
import { studentsService } from '@/services/studentsService'
import UsersPage from './UsersPage'

vi.mock('@/services/usersService', () => ({
  usersService: { list: vi.fn(), setRole: vi.fn(), linkStudent: vi.fn(), unlinkStudent: vi.fn() },
}))
vi.mock('@/services/studentsService', () => ({ studentsService: { listOptions: vi.fn() } }))

const ME = { id: 'admin-1', email: 'owner@example.com', full_name: 'Owner', role: 'admin', teacher: null, studentLinks: [] }
const PARENT = {
  id: 'parent-1', email: 'lan.vo@example.com', full_name: 'Mai', role: 'student', teacher: null,
  studentLinks: [{ student: { id: 's2', full_name: 'Võ Ngọc Lan' } }],
}
const TEACHER = { id: 't-1', email: 'teacher1@example.com', full_name: 'An', role: 'teacher', teacher: { id: 'T1', full_name: 'Nguyễn Văn An' }, studentLinks: [] }

beforeEach(() => {
  usersService.list.mockResolvedValue([ME, PARENT, TEACHER])
  usersService.setRole.mockResolvedValue(null)
  usersService.unlinkStudent.mockResolvedValue(null)
  studentsService.listOptions.mockResolvedValue([{ id: 's2', full_name: 'Võ Ngọc Lan' }, { id: 's5', full_name: 'Bùi Anh Khoa' }])
})
afterEach(cleanup)

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={{ user: { id: ME.id }, profile: ME, role: 'admin' }}>
        <UsersPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const rowOf = async (email) => (await screen.findByText(email)).closest('tr')

describe('Users page', () => {
  test('admin rows (including your own) have no role picker', async () => {
    renderPage()
    expect(within(await rowOf(ME.email)).queryByRole('combobox', { name: /role/i })).toBeNull()
  })

  test('changing a student to teacher calls set_user_role', async () => {
    renderPage()
    fireEvent.change(within(await rowOf(PARENT.email)).getByRole('combobox', { name: /role/i }), { target: { value: 'teacher' } })
    await vi.waitFor(() => expect(usersService.setRole).toHaveBeenCalledWith('parent-1', 'teacher'))
  })

  test('shows what each account is linked to, and a linked student can be removed', async () => {
    renderPage()
    expect(within(await rowOf(TEACHER.email)).getByText('Nguyễn Văn An')).toBeTruthy()
    fireEvent.click(within(await rowOf(PARENT.email)).getByRole('button', { name: 'Remove Võ Ngọc Lan' }))
    await vi.waitFor(() => expect(usersService.unlinkStudent).toHaveBeenCalledWith('parent-1', 's2'))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/users`
Expected: FAIL — `Failed to resolve import "./UsersPage"`.

- [ ] **Step 3: Implement the service, hooks and page**

`src/services/usersService.js`:

```js
import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'

// Admin only (RLS: admins read every profile and every student link).
const COLUMNS = `
  id, email, full_name, role, created_at,
  teacher:teachers!teachers_profile_id_fkey(id, full_name),
  studentLinks:student_accounts(student:students(id, full_name))
`

export const usersService = {
  async list() {
    return unwrap(await supabase.from('profiles').select(COLUMNS).order('created_at'))
  },

  /** Student ↔ teacher only; the database refuses admin, your own account and other admins. */
  async setRole(userId, role) {
    return unwrap(await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role }))
  },

  async linkStudent(profileId, studentId) {
    return unwrap(await supabase.rpc('link_student_account', { p_profile_id: profileId, p_student_id: studentId }))
  },

  async unlinkStudent(profileId, studentId) {
    return unwrap(await supabase.rpc('unlink_student_account', { p_profile_id: profileId, p_student_id: studentId }))
  },
}
```

`src/features/users/hooks.js`:

```js
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation } from '@/hooks/useAppMutation'
import { studentsService } from '@/services/studentsService'
import { usersService } from '@/services/usersService'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users.list(), queryFn: () => usersService.list() })
}

export function useStudentOptions() {
  return useQuery({ queryKey: queryKeys.students.options(), queryFn: () => studentsService.listOptions() })
}

// A role change can link/unlink teacher records, so the teachers list refreshes too.
const INVALIDATE = [queryKeys.users.all, queryKeys.teachers.all]

export function useSetUserRole() {
  return useAppMutation({
    mutationFn: ({ user, role }) => usersService.setRole(user.id, role),
    invalidate: INVALIDATE,
    successMessage: (_data, { user, role }) => `${user.full_name || user.email} is now a ${role}`,
  })
}

export function useLinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }) => usersService.linkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student linked',
  })
}

export function useUnlinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }) => usersService.unlinkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student unlinked',
  })
}
```

`src/features/users/pages/UsersPage.jsx`:

```jsx
import { X } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { NativeSelect } from '@/components/ui/input'
import { ROLES } from '@/constants/roles'
import { useLinkStudent, useSetUserRole, useStudentOptions, useUnlinkStudent, useUsers } from '../hooks'

function LinkedTo({ user, studentOptions }) {
  const unlink = useUnlinkStudent()
  const link = useLinkStudent()

  if (user.role === ROLES.TEACHER) return user.teacher?.full_name ?? <span className="text-muted-foreground">No teacher record</span>
  if (user.role !== ROLES.STUDENT) return <span className="text-muted-foreground">—</span>

  const linkedIds = new Set(user.studentLinks.map((l) => l.student.id))
  const addable = (studentOptions ?? []).filter((s) => !linkedIds.has(s.id))
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {user.studentLinks.map(({ student }) => (
        <span key={student.id} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
          {student.full_name}
          <button
            type="button"
            aria-label={`Remove ${student.full_name}`}
            className="rounded-full hover:text-danger"
            onClick={() => unlink.mutate({ profileId: user.id, studentId: student.id })}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {addable.length > 0 && (
        <NativeSelect
          aria-label={`Link a student to ${user.email}`}
          className="h-7 w-auto text-xs"
          value=""
          onChange={(e) => e.target.value && link.mutate({ profileId: user.id, studentId: e.target.value })}
        >
          <option value="">+ Link student</option>
          {addable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )
}

export default function UsersPage() {
  const users = useUsers()
  const studentOptions = useStudentOptions()
  const setRole = useSetUserRole()

  const columns = [
    {
      key: 'name',
      header: 'Account',
      cell: (u) => (
        <div>
          <div className="font-medium">{u.full_name || '—'}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) =>
        u.role === ROLES.ADMIN ? (
          <StatusBadge status={u.role} />
        ) : (
          <NativeSelect
            aria-label={`Role for ${u.email}`}
            className="h-8 w-32"
            value={u.role}
            disabled={setRole.isPending}
            onChange={(e) => setRole.mutate({ user: u, role: e.target.value })}
          >
            <option value={ROLES.STUDENT}>Student</option>
            <option value={ROLES.TEACHER}>Teacher</option>
          </NativeSelect>
        ),
    },
    { key: 'linked', header: 'Linked to', cell: (u) => <LinkedTo user={u} studentOptions={studentOptions.data} /> },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Every login starts as a student. Switch teachers to Teacher here; admins can only be changed in the database."
      />
      <DataTable
        columns={columns}
        data={users.data}
        isLoading={users.isLoading}
        error={users.error}
        onRetry={users.refetch}
        emptyTitle="No accounts yet"
      />
    </>
  )
}
```

Note: the test queries `combobox` with name `/role/i`; the role select's label is `Role for <email>` and the link select's label starts with `Link a student`, so only the role select matches.

`src/app/router.jsx` — inside the `RequireRole roles={[ROLES.ADMIN]}` children (next to `teachers`), add:

```js
                      { path: 'users', lazy: page(() => import('@/features/users/pages/UsersPage')), handle: { crumb: 'Users' } },
```

`src/services/errors.js` — add to `CONSTRAINT_MESSAGES` (they match on `details`):

```js
  role_invalid: 'Accounts can only be students or teachers here.',
  role_self: 'You can’t change your own role.',
  role_admin_target: 'Administrator accounts can only be changed in the database.',
  link_not_student: 'Only student accounts can be linked to students.',
  range_invalid: 'Choose a shorter date range.',
```

and in `src/schemas/schemas.test.js` add to the `sign-up` describe:

```js
  test('role management refusals get specific messages', () => {
    expect(toAppError({ code: '42501', message: 'x', details: 'role_self' }).message).toMatch(/your own role/)
    expect(toAppError({ code: '42501', message: 'x', details: 'role_admin_target' }).message).toMatch(/in the database/)
  })
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/users src/schemas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/usersService.js src/services/errors.js src/features/users src/app/router.jsx src/schemas/schemas.test.js
git commit -m "Users page: admin switches accounts between student and teacher

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Student pages (My classes, My fees)

**Files:**
- Create: `src/services/portalService.js`, `src/features/portal/hooks.js`, `src/features/portal/components/NotLinkedState.jsx`, `src/features/portal/pages/MyClassesPage.jsx`, `src/features/portal/pages/MyFeesPage.jsx`
- Test: `src/features/portal/pages/portal.test.jsx`
- Modify: `src/app/router.jsx`

**Interfaces:**
- Consumes: RPCs from Task 3; `queryKeys.portal` (Task 4); `MonthSwitcher({ month, onChange })` where `month` is `'yyyy-MM-dd'`; `currentBillingMonth()`, `formatBillingMonth(month)`, `formatDate`, `formatTime`, `formatInAppZone` from `@/utils/datetime`; `parseDayKey`, `dayKey` from `@/utils/calendar`; `formatCurrency` from `@/utils/format`.
- Produces: `portalService.myStudents()`, `portalService.mySchedule({ from, to })` (ISO strings), `portalService.myPayments()`.

- [ ] **Step 1: Write the failing test**

`src/features/portal/pages/portal.test.jsx`:

```jsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { portalService } from '@/services/portalService'
import MyClassesPage from './MyClassesPage'
import MyFeesPage from './MyFeesPage'

vi.mock('@/services/portalService', () => ({
  portalService: { myStudents: vi.fn(), mySchedule: vi.fn(), myPayments: vi.fn() },
}))

const LAN = { id: 's2', full_name: 'Võ Ngọc Lan', grade: 11, status: 'active' }
const TRANG = { id: 's4', full_name: 'Hoàng Thu Trang', grade: 12, status: 'active' }

beforeEach(() => {
  portalService.myStudents.mockResolvedValue([LAN])
  portalService.mySchedule.mockResolvedValue([
    { id: 'c1', student_id: 's2', student_name: 'Võ Ngọc Lan', title: 'Grammar', subject: 'English', start_time: '2026-10-05T02:00:00Z', end_time: '2026-10-05T03:00:00Z', location: 'Room 2', teacher_name: 'Trần Thị Bình' },
  ])
  portalService.myPayments.mockResolvedValue([
    { id: 'p1', student_id: 's2', student_name: 'Võ Ngọc Lan', teacher_name: 'Trần Thị Bình', billing_month: '2026-10-01', amount: 500000, status: 'unpaid', paid_at: null },
  ])
})
afterEach(cleanup)

const renderPage = (Page) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Page />
    </QueryClientProvider>,
  )

describe('student pages', () => {
  test('My classes lists the class with time (Vietnam time), subject and teacher', async () => {
    renderPage(MyClassesPage)
    expect(await screen.findByText('Grammar')).toBeTruthy()
    expect(screen.getByText(/09:00–10:00/)).toBeTruthy()
    expect(screen.getByText(/Trần Thị Bình/)).toBeTruthy()
    expect(screen.queryByText('Võ Ngọc Lan')).toBeNull() // one child: no name needed
  })

  test('with two linked students each class says whose it is', async () => {
    portalService.myStudents.mockResolvedValue([LAN, TRANG])
    renderPage(MyClassesPage)
    expect(await screen.findByText('Võ Ngọc Lan')).toBeTruthy()
  })

  test('My fees shows amount and status', async () => {
    renderPage(MyFeesPage)
    expect(await screen.findByText('Unpaid')).toBeTruthy()
    expect(screen.getByText(/500\.000/)).toBeTruthy()
  })

  test('an account with no linked student sees how to get access', async () => {
    portalService.myStudents.mockResolvedValue([])
    renderPage(MyFeesPage)
    expect(await screen.findByText(/isn’t linked to a student yet/)).toBeTruthy()
    expect(portalService.myPayments).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/portal`
Expected: FAIL — `Failed to resolve import "./MyClassesPage"`.

- [ ] **Step 3: Implement**

`src/services/portalService.js`:

```js
import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'

/** Student-only read functions (migration 0010). They return nothing for other roles. */
export const portalService = {
  async myStudents() {
    return unwrap(await supabase.rpc('my_students'))
  },

  /** Classes overlapping [from, to); the database caps the range at 100 days. */
  async mySchedule({ from, to }) {
    return unwrap(await supabase.rpc('my_schedule', { p_from: from, p_to: to }))
  },

  async myPayments() {
    return unwrap(await supabase.rpc('my_payments'))
  },
}
```

`src/features/portal/hooks.js`:

```js
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { portalService } from '@/services/portalService'

export function useMyStudents() {
  return useQuery({ queryKey: queryKeys.portal.students(), queryFn: () => portalService.myStudents() })
}

export function useMySchedule(range, { enabled }) {
  return useQuery({
    queryKey: queryKeys.portal.schedule(range),
    queryFn: () => portalService.mySchedule(range),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useMyPayments({ enabled }) {
  return useQuery({ queryKey: queryKeys.portal.payments(), queryFn: () => portalService.myPayments(), enabled })
}
```

`src/features/portal/components/NotLinkedState.jsx`:

```jsx
import { UserX } from 'lucide-react'
import { EmptyState } from '@/components/common/States'

export function NotLinkedState() {
  return (
    <EmptyState
      icon={UserX}
      title="Your account isn’t linked to a student yet"
      description="Contact your tutoring center and ask them to add your email to the student’s record."
    />
  )
}
```

`src/features/portal/pages/MyClassesPage.jsx`:

```jsx
import { useState } from 'react'
import { addMonths } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { Card, CardContent } from '@/components/ui/card'
import { MonthSwitcher } from '@/features/payments/components/MonthSwitcher'
import { dayKey, parseDayKey } from '@/utils/calendar'
import { currentBillingMonth, formatInAppZone, formatTime } from '@/utils/datetime'
import { NotLinkedState } from '../components/NotLinkedState'
import { useMySchedule, useMyStudents } from '../hooks'

export default function MyClassesPage() {
  const [month, setMonth] = useState(currentBillingMonth)
  const students = useMyStudents()
  const from = parseDayKey(month)
  const range = { from: from.toISOString(), to: addMonths(from, 1).toISOString() }
  const linked = Boolean(students.data?.length)
  const classes = useMySchedule(range, { enabled: linked })
  const showStudent = (students.data?.length ?? 0) > 1

  const byDay = new Map()
  for (const c of classes.data ?? []) {
    const key = dayKey(c.start_time)
    byDay.set(key, [...(byDay.get(key) ?? []), c])
  }

  let body
  if (students.isLoading || (linked && classes.isLoading)) body = <LoadingState />
  else if (students.error || classes.error) body = <ErrorState error={students.error ?? classes.error} onRetry={() => (students.error ? students.refetch() : classes.refetch())} />
  else if (!linked) body = <NotLinkedState />
  else if (!byDay.size) body = <EmptyState icon={CalendarDays} title="No classes this month" />
  else
    body = (
      <div className="grid gap-4">
        {[...byDay].map(([key, items]) => (
          <Card key={key}>
            <CardContent className="grid gap-3 p-4">
              <h2 className="text-sm font-semibold">{formatInAppZone(parseDayKey(key), 'EEEE, dd/MM')}</h2>
              {items.map((c) => (
                <div key={c.id} className="flex flex-col gap-0.5 border-l-2 border-primary pl-3 text-sm">
                  <span className="font-medium tabular-nums">
                    {formatTime(c.start_time)}–{formatTime(c.end_time)} · {c.subject}
                  </span>
                  <span>{c.title}</span>
                  <span className="text-muted-foreground">
                    {c.teacher_name}
                    {c.location ? ` · ${c.location}` : ''}
                  </span>
                  {showStudent && <span className="text-xs text-primary">{c.student_name}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )

  return (
    <>
      <PageHeader title="My classes" actions={linked && <MonthSwitcher month={month} onChange={setMonth} />} />
      {body}
    </>
  )
}
```

`src/features/portal/pages/MyFeesPage.jsx`:

```jsx
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatBillingMonth, formatDate } from '@/utils/datetime'
import { formatCurrency } from '@/utils/format'
import { NotLinkedState } from '../components/NotLinkedState'
import { useMyPayments, useMyStudents } from '../hooks'

export default function MyFeesPage() {
  const students = useMyStudents()
  const linked = Boolean(students.data?.length)
  const payments = useMyPayments({ enabled: linked })
  const showStudent = (students.data?.length ?? 0) > 1

  const columns = [
    { key: 'billing_month', header: 'Month', cell: (p) => formatBillingMonth(p.billing_month) },
    ...(showStudent ? [{ key: 'student_name', header: 'Student' }] : []),
    { key: 'teacher_name', header: 'Teacher' },
    { key: 'amount', header: 'Amount', className: 'text-right tabular-nums', cell: (p) => formatCurrency(p.amount) },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'paid_at', header: 'Paid on', cell: (p) => formatDate(p.paid_at) },
  ]

  let body
  if (students.isLoading) body = <LoadingState />
  else if (students.error) body = <ErrorState error={students.error} onRetry={students.refetch} />
  else if (!linked) body = <NotLinkedState />
  else
    body = (
      <DataTable
        columns={columns}
        data={payments.data}
        isLoading={payments.isLoading}
        error={payments.error}
        onRetry={payments.refetch}
        emptyTitle="No fees yet"
      />
    )

  return (
    <>
      <PageHeader title="My fees" description="Monthly tuition recorded by your teachers." />
      {body}
    </>
  )
}
```

`src/app/router.jsx` — after the staff `RequireRole` group inside `'/'` children, add:

```js
              {
                element: <RequireRole roles={[ROLES.STUDENT]} />,
                children: [
                  { path: 'my/classes', lazy: page(() => import('@/features/portal/pages/MyClassesPage')), handle: { crumb: 'My classes' } },
                  { path: 'my/fees', lazy: page(() => import('@/features/portal/pages/MyFeesPage')), handle: { crumb: 'My fees' } },
                ],
              },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/portal`
Expected: PASS (`formatCurrency(500000)` renders `500.000 ₫`).

- [ ] **Step 5: Commit**

```bash
git add src/services/portalService.js src/features/portal src/app/router.jsx
git commit -m "Student pages: My classes and My fees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sign-up copy, README, full verification and release

**Files:**
- Modify: `src/features/auth/pages/SignupPage.jsx`, `src/services/errors.js`, `src/schemas/schemas.test.js`, `README.md`

- [ ] **Step 1: Update the failing expectation first**

In `src/schemas/schemas.test.js`, change the sign-up refusal test to:

```js
  test('a sign-up refused by the database allowlist gets an actionable message', () => {
    const refused = { name: 'AuthApiError', __isAuthError: true, status: 500, code: 'unexpected_failure', message: 'Database error saving new user' }
    expect(toAppError(refused).message).toMatch(/isn’t registered with your tutoring center/)
  })
```

Run: `npx vitest run src/schemas` → Expected: FAIL (old message).

- [ ] **Step 2: Update messages and copy**

`src/services/errors.js`, in the `Database error saving new user` branch:

```js
    return new AppError(
      'This email isn’t registered with your tutoring center. Ask the center to add it to your student or teacher record first.',
      { code: error.code, cause: error },
    )
```

`src/features/auth/pages/SignupPage.jsx`, the `AuthShell` description:

```jsx
      description="For students, parents and teachers. Use the email your tutoring center has on file."
```

`src/features/auth/pages/LoginPage.jsx`, the description: `"Students, parents and teachers registered with the center can create their own account."`

Run: `npx vitest run src/schemas src/features/auth` → Expected: PASS.

- [ ] **Step 3: README**

In `README.md`:
- Roles table/intro: add a **Student** column/row: "Read-only: their own classes and monthly fees (via `my_*` functions)".
- "Key decisions": replace the sign-up bullet with: "**Every new login is a student.** Sign-up is limited to emails on a teacher or student record. The admin switches accounts between student and teacher on the Users page (`set_user_role`); admin is granted only with SQL."
- Step 5 "Give teachers a login" becomes: "1. Add the teacher record. 2. The teacher signs up at `/signup` and confirms. 3. On **Users**, switch them to **Teacher**; the login links to the teacher record."
- New step "Give students and parents a login": "Put their email on the student record (siblings may share a parent's email). They sign up at `/signup`, confirm, and are linked automatically."
- Known limitations: replace the sign-up trade-off line's wording "belongs to a teacher" with "is registered with the center".

- [ ] **Step 4: Full check**

Run: `npm run check`
Expected: lint clean, all Vitest tests pass, `# fail 0` for DB tests, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src README.md
git commit -m "Sign-up copy and docs for the student role

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Pre-flight on production**

Via Supabase MCP `execute_sql` (read-only): `select email, role from public.profiles where role = 'admin';`
Expected: the owner's row. **If no admin exists, stop and ask the user to run the promotion SQL first** (spec Rollout 1).

- [ ] **Step 7: Apply the migration**

Supabase MCP `apply_migration` with name `student_role` and the full contents of `supabase/migrations/20260930001000_student_role.sql`.

- [ ] **Step 8: Verify the live structure**

`execute_sql`:

```sql
select
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_role_check') as role_check,
  (select column_default from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') as role_default,
  (select relrowsecurity from pg_class where oid = 'public.student_accounts'::regclass) as links_rls,
  (select count(*) from pg_policies where tablename = 'student_accounts') as links_policies,
  (select jsonb_agg(p.proname order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('set_user_role','link_student_account','unlink_student_account','my_students','my_schedule','my_payments')) as functions,
  (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'public'::regnamespace) as anon_can_execute_any,
  (select count(*) from pg_trigger where tgname = 'students_link_accounts') as link_trigger;
```

Expected: role check lists admin/teacher/student, default `'student'`, `links_rls = true`, 1 policy, 6 functions, `anon_can_execute_any = false`, trigger count 1. Then `get_advisors` (security): no new findings besides the known leaked-password warning.

- [ ] **Step 9: Push and verify the deploy**

```bash
git push origin main
```

Wait for the Vercel deployment of the new commit to be `READY` (Vercel MCP `list_deployments` for project `prj_MsYJoMiDvWoG07rfUSOyfrZ67IAl`), then confirm `https://tutorflow-omega.vercel.app/my/classes` and `/users` return 200 and the bundle contains `UsersPage` and `MyClassesPage` chunks.
