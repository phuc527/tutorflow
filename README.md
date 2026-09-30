# TutorFlow

A management app for a small private tutoring centre: teachers, students, class schedules and
monthly paid/unpaid status, with role-based access for **admins** and **teachers**.

Built with React + Vite on the front end and **Supabase** (Postgres, Auth, Row Level Security) as
the whole back end. There is no separate server: the browser talks to Supabase directly, and the
database itself enforces who may see and change what.

- [Features](#features) · [Architecture](#architecture) · [Security model](#security-model)
- [Local setup](#local-setup) · [Scripts](#scripts) · [Deploy to Vercel](#deploy-to-vercel)
- [Troubleshooting](#troubleshooting) · [Assumptions](#assumptions-and-limitations)
- Testing guide: [docs/TESTING.md](docs/TESTING.md)

## Features

| | Admin | Teacher |
|---|---|---|
| Dashboard | Centre-wide stats, 6-month payment chart, upcoming classes | Same page, scoped to their own students and classes |
| Teachers | Create / edit / delete, search, status filter, pagination, "login linked" indicator | — |
| Students | Create / edit / delete, assign teachers, filter by teacher / grade / status, this month's payment status | Read-only list of their assigned students |
| Schedules | Month / week / day / list calendar of all classes, read-only | Create / edit / delete their own classes for assigned students; overlaps rejected |
| Payments | View all records, totals and history, read-only | Create monthly records in one click, mark paid/unpaid with confirmation, edit amount/notes, view history |

All dates and times are shown and entered in **Asia/Ho_Chi_Minh (GMT+7)**, whatever the device's timezone.
There is no payment gateway; payment status is a manual Paid/Unpaid flag.

## Architecture

```
Browser (React)                                   Supabase
┌──────────────────────────────────────────┐      ┌────────────────────────────────────┐
│ pages/components                         │      │ Auth (sessions, JWT)                │
│   ↓ hooks (TanStack Query: cache,        │      │                                     │
│     loading/error, invalidation)         │ JWT  │ PostgREST API                       │
│   ↓ services/*.js  ← only place that ────┼─────►│   ↓ runs every query AS THE USER    │
│     imports the Supabase client          │      │ Postgres                            │
│                                          │      │   GRANTs  → which columns           │
│ Route guards + permission map (UX only)  │      │   RLS     → which rows              │
└──────────────────────────────────────────┘      │   CHECK / UNIQUE / EXCLUDE → rules  │
                                                  │   triggers → audit fields, history  │
                                                  └────────────────────────────────────┘
```

```
src/
  app/            App, router (lazy-loaded routes + guards), providers
  components/
    ui/           shadcn-style primitives (Button, Dialog, Table…)
    common/       DataTable, ConfirmDialog, FormModal, StatusBadge, PageHeader, states…
    layout/       AppLayout, Sidebar, Breadcrumbs, UserMenu
  features/       auth, dashboard, teachers, students, schedules, payments
                  (each: pages/, components/, hooks.js)
  services/       Supabase calls + error translation (errors.js)
  schemas/        zod form validation (mirrors the DB CHECK constraints)
  constants/      roles, permissions, navigation, query keys
  hooks/          useAppMutation, useListParams, usePermission…
  utils/          timezone-safe date/calendar helpers, formatting
supabase/
  migrations/     schema, auth helpers, triggers, RLS, RPC functions (run in order)
  seed.sql        development data (records only, no logins or passwords)
  tests/          RLS test suite (PGlite) + a stub of Supabase's auth schema
scripts/          check-supabase.mjs, bundle-migrations.mjs
docs/TESTING.md   test plan for all required scenarios
```

**Data flow example: marking a payment paid.** `PaymentsPage` → `useSetPaymentStatus()` →
`paymentsService.setStatus(id, 'paid')` → `UPDATE payments SET status='paid'`. Postgres then
checks the column grant (teachers may only write `status`, `amount`, `notes`), the RLS policy (only
your own payments, for students assigned to you), and a trigger sets `paid_at = now()`,
`marked_by = auth.uid()` and appends a `payment_history` row. The client never sends who or when.

## Security model

RBAC is enforced twice:

1. **Frontend (UX):** route guards (`RequireAuth`, `RequireRole`) and `usePermission()` hide what
   you can't use. This is a convenience only, because anyone can call the API directly with the public key.
2. **Database (the real boundary):** every request runs as the logged-in user.

| Table | Admin | Teacher |
|---|---|---|
| profiles | read all | read / update own name, phone, avatar (**not role**) |
| teachers | full CRUD | read own record |
| students | full CRUD | read assigned students |
| teacher_students | read, assign, unassign | read own assignments |
| schedules | read all, **no writes** | CRUD own, assigned students only |
| payments | read all, **no writes** | read own; create/update for assigned students; **no deletes** |
| payment_history | read all | read history of own payments; nobody can write it directly |

Key decisions (details in the migration comments):

- **Teacher records link only to logins with a confirmed email.** An unconfirmed sign-up using a
  teacher's address gets no access and learns nothing about the record.
- **Self sign-up is limited to teachers the admin has added.** A trigger on `auth.users` refuses any
  new login whose email doesn't match a non-inactive teacher record (until the first admin exists, so
  that admin can be created).
- **The role lives only in `profiles.role`.** New logins are always `teacher`, and sign-up metadata is
  ignored. A column grant plus a trigger stop users changing their own role. Admins are promoted with SQL.
- **RLS helper functions** (`private.is_admin()`, `private.current_teacher_id()`,
  `private.is_assigned_to_me()`) are `SECURITY DEFINER` so policies on `profiles` don't recurse into
  themselves. They use `search_path = ''`, only ever answer questions about the caller, and live in a
  schema that isn't exposed over the API.
- **Overlaps are prevented by `EXCLUDE USING gist` constraints** (per teacher and per student).
  They're checked atomically inside the index, so two simultaneous requests can't both book the same slot.
  An app-side "check, then insert" can't guarantee that.
- **Server-owned fields** (`created_by`, `paid_at`, `marked_by`) are set by triggers; clients have no
  write privilege on them at all. A **paid** record's amount is frozen, and every history row stores the amount.
- **Payment edits use optimistic concurrency** (`updated_at`), so a stale tab can't overwrite a newer change.
- **The build refuses secret keys:** `vite.config.js` fails if any `VITE_*` value is a `service_role`/`sb_secret_` key,
  and Vercel builds fail when the Supabase env vars are missing.
- `TRUNCATE` (which bypasses RLS) is revoked, and logged-out visitors (`anon`) have no table access.

## Local setup

### Prerequisites
- Node.js 20+ (developed on 22)
- A Supabase project (free tier is fine): <https://supabase.com/dashboard>

### 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` from **Supabase Dashboard → Project Settings → API**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
```

> Never put the `service_role` / secret key in any `VITE_` variable. Everything prefixed `VITE_` is
> bundled into the JavaScript that browsers download.

### 2. Create the database

**Option A: SQL Editor (simplest).** Generate one file with every migration (plus demo data):

```bash
npm run db:bundle -- --seed      # → supabase/.generated/setup.sql  (omit --seed for production)
```

Paste its contents into **Dashboard → SQL Editor** and run it. Alternatively, run each file in
`supabase/migrations/` in filename order, then `supabase/seed.sql`.

**Option B: Supabase CLI.**

```bash
npx supabase init            # once; creates supabase/config.toml
npx supabase link --project-ref <project-ref>
npx supabase db push         # applies supabase/migrations/*
```

When you add a migration later, apply only the new file (Option A) or run `db push` again (Option B).

### 3. Configure sign-ups

**Dashboard → Authentication → Sign In / Providers:** turn **on** "Allow new users to sign up" and keep
**"Confirm email" on**.

Teachers create their own account at `/signup`, but only with an email the admin has already added as
a teacher: the database refuses every other address (migration 0008). Email confirmation proves they
own the address before the login is linked to the teacher record.

### 4. Create the first admin

Do this before adding any teacher. While no admin exists, the sign-up gate lets any login be created;
it closes as soon as the first admin is promoted. No password is ever stored in this repository. Instead:

1. **Dashboard → Authentication → Users → Add user → Create new user**: your email, a strong password, tick *Auto Confirm User*.
2. **SQL Editor:**
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

This is secure because role changes are only possible from a trusted context (the SQL Editor or the
service role), never through the app's API.

### 5. Give teachers a login

1. In the app (as admin) create the teacher record with their email. The *Login* column shows **None**.
2. The teacher opens `/signup`, uses that same email, and clicks the confirmation link they receive.
   (Alternatively, **Add user** in the Dashboard with the same email.)
3. A trigger links the confirmed login to the teacher record automatically, and *Login* turns to **Linked**.

With the seed data, create `teacher1@example.com` and `teacher2@example.com` to try the teacher role.

### 6. Run it

```bash
npm run check:supabase   # confirms tables exist and anonymous access is refused
npm run dev              # http://localhost:5173
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `preview` | Production build / serve it locally |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest), run under a foreign timezone on purpose |
| `npm run test:db` | RLS & business-rule tests against the real migrations in PGlite (no Docker or Supabase needed) |
| `npm run check` | All of the above + build |
| `npm run check:supabase` | Read-only smoke test of your live project |
| `npm run db:bundle [-- --seed]` | One-file SQL for the SQL Editor |

## Deploy to Vercel

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. **vercel.com → Add New → Project → import the repo.** Vercel detects Vite:
   build command `npm run build`, output directory `dist`.
3. **Environment Variables:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the same public
   values as local). Vite bakes them in at build time, so **redeploy after changing them**.
4. **Deploy.**
5. In **Supabase → Authentication → URL Configuration**:
   - *Site URL*: `https://<your-app>.vercel.app`
   - *Redirect URLs*: add `https://<your-app>.vercel.app/**` (and `http://localhost:5173/**` for local dev),
     so sign-up confirmation, invite and password-reset links return to the app.

`vercel.json` already contains:
- a **rewrite of every path to `index.html`**, so refreshing `/payments` works. Without it Vercel
  would look for a file called `payments` and return 404.
- security headers including a **Content-Security-Policy** (scripts only from the app itself, network
  calls only to `*.supabase.co`), and long-term caching for the hashed files in `/assets`.

After a redeploy, open tabs that request an old chunk file reload once automatically instead of crashing.

Use a **separate Supabase project for production** and don't run `seed.sql` there.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `check:supabase` says *table … missing* / app errors with `PGRST205` | Migrations not applied, see step 2 |
| Login works but "Couldn't load your account" | The profile row is missing: the user was created before the migrations ran. Delete and re-add the user, or insert the profile manually |
| Teacher sees nothing / "not linked to a teacher record" | No `teachers` row has that login's email (check spelling), or the teacher is *Inactive* |
| "You don't have permission to do that." | RLS refused the request; you're using the wrong role for that action (by design) |
| 404 on refresh after deploy | `vercel.json` missing from the deployed repo |
| Changed env vars on Vercel but nothing changed | Redeploy: `VITE_` values are baked in at build time |

## Assumptions and limitations

Decisions made where the brief left room; all are easy to change.

- **Currency** is VND (whole đồng); **grades** are the Vietnamese school grades 1–12.
- **A class starts and ends on the same day** in the form (the database allows up to 12 hours).
- **Payment amounts** default to *hours scheduled that month × the teacher's hourly rate* (rounded to
  1,000 đ) when a teacher creates the month's records, and can be edited afterwards.
- **Payment records can't be deleted**, and teachers/students that have **classes or payment records** can't
  be deleted either (so an admin can never remove schedules indirectly); set them to *Inactive* instead.
  An inactive teacher immediately loses access.
- **Unpaid is shown in amber, not red**, because green against red is indistinguishable for the most
  common colour blindness (validated: ΔE 5.0 vs 17.4 for green/amber).
- **Teachers sign themselves up; the admin can't invite from the app.** Sending invitations would need
  the service-role key on a server (e.g. a Supabase Edge Function), which was out of scope.
- **The sign-up error reveals whether an email belongs to a teacher.** A generic message would confuse
  real teachers; for an internal tool this trade-off was accepted.
- No password-reset screen in the app yet; admins can send a reset from the Dashboard.
