# TutorFlow testing guide

TutorFlow is tested at three levels. Security rules are tested **in the database itself**, because
hiding a button in React protects nothing: anyone can call the Supabase API directly with the public key.

| Level | Command | What it covers |
|---|---|---|
| Database / RLS | `npm run test:db` | Runs the real migrations in an in-process Postgres (PGlite) and acts as anon, admin and two teachers exactly like Supabase does. 34 tests. |
| Unit | `npm test` | Timezone maths (run under `America/New_York` to catch local-timezone leaks), form schemas, error translation, the UI permission map. |
| Live project smoke check | `npm run check:supabase` | Uses your `.env` public key against your real project: tables exist, logged-out access is refused. Read-only. |
| Everything | `npm run check` | lint + unit + database tests + production build |

## Test accounts

After applying the migrations and `seed.sql`, create these logins in **Supabase Dashboard → Authentication → Users → Add user** (tick *Auto Confirm User*):

| Email | Becomes | Assigned students (seed) |
|---|---|---|
| your own email | admin (promote with the SQL in the README) | — |
| `teacher1@example.com` | Nguyễn Văn An (Mathematics) | Phạm Gia Huy, Đặng Quốc Bảo, Bùi Anh Khoa |
| `teacher2@example.com` | Trần Thị Bình (English) | Võ Ngọc Lan, Hoàng Thu Trang, Phạm Gia Huy |

Phạm Gia Huy is shared by both teachers, which is what makes the cross-teacher overlap test possible.

## Required scenarios

**Auto** = covered by an automated test (named after the test in `supabase/tests/rls.test.mjs` or a `*.test.js` file).
**Manual** = steps to click through in the running app (`npm run dev`).

| # | Scenario | Auto | Manual steps | Expected |
|---|---|---|---|---|
| 1 | Admin can log in | — | Log in with the admin account | Dashboard with 5 stat tiles; sidebar shows Teachers |
| 2 | Teacher can log in | — | Log in as `teacher1@example.com` | Dashboard with 4 tiles; sidebar shows *My Students*, no Teachers |
| 3 | Admin can create a teacher | `admin can create a teacher, a student and an assignment` | Teachers → Add teacher → fill in → Create | Toast "Teacher created"; row appears. Try a duplicate email → "A teacher with this email already exists." |
| 4 | Admin can create a student | same | Students → Add student | Toast "Student created" |
| 5 | Admin can assign a student to a teacher | `set_student_teachers replaces a student’s assignments atomically` | Students → ⋯ → Assign teachers → tick → Save | Teacher badges update on the row |
| 6 | Admin cannot create a schedule | `admin cannot create a schedule` | As admin open Schedules | No "New class" button, clicking a slot does nothing, class details have no Edit/Delete. The API refuses too (see §API checks) |
| 7 | Teacher can create a schedule for an assigned student | `teacher creates a schedule for an assigned student` | As teacher1 → Schedules → Week → click an empty slot → choose Huy → Create | Class appears in the grid |
| 8 | Teacher cannot schedule an unassigned student | `teacher cannot schedule an unassigned student or on behalf of another teacher` | Open the New class form as teacher1 | Student list only has Huy, Bảo, Khoa. The API refuses others (see §API checks) |
| 9 | Teacher cannot edit another teacher’s schedule | `teacher cannot see, edit or delete another teacher’s schedule` | As teacher2 create a class; log in as teacher1 | teacher1 cannot see it at all |
| 10 | Admin cannot update payment status | `admin can read payments but cannot create or update them` | As admin → Payments | No Mark paid / Edit buttons, only View history |
| 11 | Teacher can mark an assigned student paid | `teacher marks an assigned student paid → paid_at, marked_by and history are recorded` | As teacher1 → Payments → Create records for this month → Mark paid → Confirm | Green *Paid* badge, today's paid date, your name in *Marked by*; ⋯ → View history shows Unpaid → Paid |
| 12 | Teacher cannot update another teacher’s payment | `teacher cannot update another teacher’s payment or bill an unassigned student`, `teachers cannot read each other’s payments or payment history` | As teacher2 create records; log in as teacher1 | teacher1 sees only their own records |
| 13 | Unauthorized users cannot access protected routes | `anonymous visitors cannot read any table` | Log out, open `/payments` → redirected to `/login`. As teacher open `/teachers` | `/login`, then `/unauthorized` |
| 14 | Refreshing preserves the session | — | Logged in, press F5 on any page | Still logged in, same page and filters (they're in the URL) |
| 15 | Invalid schedule time is rejected | `end time must be after start time`, `rejects an end time that is not after the start` | New class with End before Start | Inline "End time must be later than start time" |
| 16 | Overlapping schedules are rejected | `overlapping schedules for the same teacher…`, `…for the same student, even across teachers` | teacher1: Huy 09:00–10:00. teacher2: Huy 09:30–10:30 | Toast "This student already has a class at this time (possibly with another teacher)." Back-to-back 10:00–11:00 is allowed |
| 17 | Works on mobile screens | — | Browser devtools → device toolbar → iPhone SE (375px) | Sidebar becomes a ☰ drawer; tables scroll sideways; filters stack; month view shows "N classes" per day; week view scrolls sideways; dialogs fit the screen |

### Extra checks worth doing once

- **Timezone:** set your computer to another timezone (e.g. New York), reload. Class times must not change.
- **Role cannot be self-assigned:** `user cannot change their own role` + `new login gets a teacher profile; role in sign-up metadata is ignored`.
- **Financial records are protected:** `deleting a teacher who has payment records is blocked` → in the UI, deleting such a teacher shows "…Set it to inactive instead."
- **Inactive teacher:** as admin set teacher1 to *Inactive*; teacher1's students/schedules/payments disappear and a warning explains why.

## API checks (bypassing the UI)

These prove the database, not the React code, is enforcing the rules. Log in as **teacher1**, open the browser devtools console on the app, and run:

```js
const { supabase } = await import('/src/lib/supabase.js')

// 8. Schedule an unassigned student (Võ Ngọc Lan) → refused
await supabase.from('schedules').insert({
  teacher_id: (await supabase.from('teachers').select('id').single()).data.id,
  student_id: '22222222-2222-4222-8222-000000000002',
  title: 'x', subject: 'x',
  start_time: '2030-01-01T02:00:00Z', end_time: '2030-01-01T03:00:00Z',
})
// → error.code "42501" (new row violates row-level security policy)

// Self-promotion → refused
await supabase.from('profiles').update({ role: 'admin' }).eq('id', (await supabase.auth.getUser()).data.user.id)
// → error.code "42501" (permission denied)

// Forge a paid date → refused
await supabase.from('payments').update({ paid_at: '2020-01-01' }).neq('id', '00000000-0000-0000-0000-000000000000')
// → error.code "42501"
```

As **admin**, the same console:

```js
const { supabase } = await import('/src/lib/supabase.js')
await supabase.from('payments').update({ status: 'paid' }).neq('id', '00000000-0000-0000-0000-000000000000').select()
// → data: []  (no rows are updatable for an admin; nothing changed)
```

(`/src/lib/supabase.js` is importable like this only on the dev server, `npm run dev`.)
