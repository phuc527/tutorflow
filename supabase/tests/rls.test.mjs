/**
 * Database security tests: run the real migrations in an in-process Postgres (PGlite) and act as
 * different users exactly the way Supabase does (SET ROLE authenticated + JWT claims).
 * This tests the policies themselves, not the React UI.
 *
 *   npm run test:db
 */
import { before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

const root = path.resolve(import.meta.dirname, '..')

// ---- fixed identities -------------------------------------------------------
const U = {
  admin: 'aaaaaaaa-0000-4000-8000-000000000001',
  t1: 'aaaaaaaa-0000-4000-8000-000000000002', // teacher1@example.com
  t2: 'aaaaaaaa-0000-4000-8000-000000000003', // teacher2@example.com
  stray: 'aaaaaaaa-0000-4000-8000-000000000005', // login with no teacher record
}
const T1 = '11111111-1111-4111-8111-000000000001'
const T2 = '11111111-1111-4111-8111-000000000002'
const S = (n) => `22222222-2222-4222-8222-00000000000${n}` // T1: S1,S3,S5  T2: S1,S2,S4

let db

before(async () => {
  db = new PGlite({ extensions: { btree_gist } })
  await db.exec(await readFile(path.join(root, 'tests/supabase-stub.sql'), 'utf8'))

  const migrationsDir = path.join(root, 'migrations')
  for (const file of (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))
  }
  await db.exec(await readFile(path.join(root, 'seed.sql'), 'utf8'))

  // Simulate sign-ups. The admin tries to self-promote through metadata; it must be ignored.
  await db.query(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
    ($1, 'owner@example.com', '{"role":"admin","full_name":"Owner"}', now()),
    ($2, 'TEACHER1@example.com', '{}', now()),
    ($3, 'teacher2@example.com', '{}', now()),
    ($4, 'stray@example.com', '{}', now())`, [U.admin, U.t1, U.t2, U.stray])

  // Since migration 0010 every new login is a student. The fixed teacher logins are switched to
  // teacher the way an admin would, then linked (link_teacher_for_user only links teacher-role logins).
  await db.query(`update public.profiles set role = 'teacher' where id = any($1::uuid[])`, [[U.t1, U.t2, U.stray]])
  await db.query(`select private.link_teacher_for_user(id) from public.profiles where id = any($1::uuid[])`, [[U.t1, U.t2, U.stray]])
})

/** Run `fn` in a transaction that is always rolled back. `as(uid|null)` switches the acting user. */
async function tx(fn) {
  await db.exec('begin')
  try {
    // as(uid) → that user; as(null) → anonymous visitor; as(SUPER) → trusted context (like the SQL editor)
    const as = async (uid) => {
      await db.exec('reset role')
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        uid && uid !== SUPER ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '',
      ])
      if (uid !== SUPER) await db.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    }
    // Each statement runs inside a savepoint: a failing statement is rolled back on its own
    // instead of aborting the whole transaction, so a test can assert several rejections in a row.
    const run = async (sql, params) => {
      await db.exec('savepoint stmt')
      try {
        const result = await db.query(sql, params)
        await db.exec('release savepoint stmt')
        return result
      } catch (err) {
        await db.exec('rollback to savepoint stmt')
        throw err
      }
    }
    const q = async (sql, params) => (await run(sql, params)).rows
    return await fn({ as, q, run })
  } finally {
    await db.exec('rollback')
  }
}

async function rejects(promise, code, constraint) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected SQLSTATE ${code}, got ${err.code}: ${err.message}`)
    if (constraint) assert.equal(err.constraint, constraint)
    return true
  })
}

const SUPER = Symbol('superuser')

/** Promote the admin login, as a trusted context (bypasses RLS, like the SQL editor). */
async function promoteAdmin(as, run) {
  await as(SUPER)
  await run(`update public.profiles set role = 'admin' where id = $1`, [U.admin])
}

const schedule = (teacher, student, start, end) => [
  `insert into public.schedules (teacher_id, student_id, title, subject, start_time, end_time)
   values ($1, $2, 'Lesson', 'Math', $3, $4) returning *`,
  [teacher, student, start, end],
]

// =============================================================================
describe('sign-up and roles', () => {
  test('new login gets a student profile; role in sign-up metadata is ignored', () =>
    tx(async ({ q }) => {
      const [p] = await q(`select role, full_name from public.profiles where id = $1`, [U.admin])
      assert.equal(p.role, 'student')
      assert.equal(p.full_name, 'Owner')
    }))

  test('login is linked to the existing teacher record by email (case-insensitive)', () =>
    tx(async ({ q }) => {
      const [t] = await q(`select profile_id from public.teachers where id = $1`, [T1])
      assert.equal(t.profile_id, U.t1)
      const [p] = await q(`select full_name from public.profiles where id = $1`, [U.t1])
      assert.equal(p.full_name, 'Nguyễn Văn An')
    }))

  test('teacher record created after the login is linked too', () =>
    tx(async ({ q, as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      const [t] = await q(`insert into public.teachers (full_name, email) values ('Stray Teacher', 'stray@example.com') returning profile_id`)
      assert.equal(t.profile_id, U.stray)
    }))

  test('a user cannot change their own role', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(`update public.profiles set role = 'admin' where id = $1`, [U.t1]), '42501')
    }))

  test('a user can edit their own name but not someone else’s profile', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      assert.equal((await run(`update public.profiles set full_name = 'An N.' where id = $1`, [U.t1])).affectedRows, 1)
      assert.equal((await run(`update public.profiles set full_name = 'Hacked' where id = $1`, [U.t2])).affectedRows, 0)
    }))
})

// =============================================================================
describe('read access', () => {
  test('anonymous visitors cannot read any table', () =>
    tx(async ({ as, run }) => {
      await as(null)
      await rejects(run(`select * from public.students`), '42501')
    }))

  test('admin sees all students; teacher sees only assigned; unlinked login sees none', () =>
    tx(async ({ as, q, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      assert.equal((await q(`select id from public.students`)).length, 6)
      await as(U.t1)
      const mine = (await q(`select id from public.students order by id`)).map((r) => r.id)
      assert.deepEqual(mine, [S(1), S(3), S(5)])
      await as(U.stray)
      assert.equal((await q(`select id from public.students`)).length, 0)
    }))

  test('teacher sees only their own teacher record and profile', () =>
    tx(async ({ as, q }) => {
      await as(U.t1)
      assert.deepEqual((await q(`select id from public.teachers`)).map((r) => r.id), [T1])
      assert.deepEqual((await q(`select id from public.profiles`)).map((r) => r.id), [U.t1])
    }))

  test('inactive teacher loses access to students', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`update public.teachers set status = 'inactive' where id = $1`, [T1])
      await as(U.t1)
      assert.equal((await q(`select id from public.students`)).length, 0)
    }))
})

// =============================================================================
describe('admin management', () => {
  test('admin can create a teacher, a student and an assignment', () =>
    tx(async ({ as, q, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      const [t] = await q(`insert into public.teachers (full_name, email) values ('New Teacher', 'new@example.com') returning id`)
      const [s] = await q(`insert into public.students (full_name, grade) values ('New Student', 5) returning id`)
      await run(`insert into public.teacher_students (teacher_id, student_id) values ($1, $2)`, [t.id, s.id])
    }))

  test('teachers cannot create students, teachers or assignments', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(`insert into public.students (full_name) values ('Sneaky')`), '42501')
      await rejects(run(`insert into public.teachers (full_name, email) values ('Sneaky', 'x@example.com')`), '42501')
      await rejects(run(`insert into public.teacher_students (teacher_id, student_id) values ($1, $2)`, [T1, S(2)]), '42501')
    }))

  test('set_student_teachers replaces a student’s assignments atomically (admin only)', () =>
    tx(async ({ as, q, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      // S1 is assigned to T1 and T2 in the seed → keep only T2
      await run(`select public.set_student_teachers($1, $2)`, [S(1), [T2]])
      const rows = await q(`select teacher_id from public.teacher_students where student_id = $1`, [S(1)])
      assert.deepEqual(rows.map((r) => r.teacher_id), [T2])

      await as(U.t1)
      await rejects(run(`select public.set_student_teachers($1, $2)`, [S(1), [T1]]), '42501')
      await as(null)
      await rejects(run(`select public.set_student_teachers($1, $2)`, [S(1), [T1]]), '42501')
    }))

  test('admin cannot set teachers.profile_id directly', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(`update public.teachers set profile_id = $1 where id = $2`, [U.admin, T2]), '42501')
    }))

  test('deleting a teacher who has payment records is blocked', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await run(`insert into public.payments (student_id, teacher_id, billing_month, amount) values ($1, $2, '2026-09-01', 100000)`, [S(1), T1])
      await promoteAdmin(as, run)
      await as(U.admin)
      // ON DELETE RESTRICT raises restrict_violation (23001), not the generic FK error 23503.
      await rejects(run(`delete from public.teachers where id = $1`, [T1]), '23001')
    }))

  test('authenticated users cannot TRUNCATE (which would bypass RLS)', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(`truncate public.students cascade`), '42501')
    }))
})

// =============================================================================
describe('schedules', () => {
  test('admin cannot create a schedule', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07')), '42501')
    }))

  test('teacher creates a schedule for an assigned student; created_by is set by the server', () =>
    tx(async ({ as, q }) => {
      await as(U.t1)
      const [row] = await q(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      assert.equal(row.created_by, U.t1)
    }))

  test('teacher cannot forge created_by', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(
        run(`insert into public.schedules (teacher_id, student_id, title, subject, start_time, end_time, created_by)
             values ($1, $2, 'x', 'x', '2026-10-01T09:00+07', '2026-10-01T10:00+07', $3)`, [T1, S(1), U.t2]),
        '42501',
      )
    }))

  test('teacher cannot schedule an unassigned student or on behalf of another teacher', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(...schedule(T1, S(2), '2026-10-01T09:00+07', '2026-10-01T10:00+07')), '42501')
      await rejects(run(...schedule(T2, S(1), '2026-10-01T11:00+07', '2026-10-01T12:00+07')), '42501')
    }))

  test('teacher cannot see, edit or delete another teacher’s schedule', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t2)
      const [row] = await q(...schedule(T2, S(2), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      await as(U.t1)
      assert.equal((await q(`select id from public.schedules where id = $1`, [row.id])).length, 0)
      assert.equal((await run(`update public.schedules set title = 'Hijacked' where id = $1`, [row.id])).affectedRows, 0)
      assert.equal((await run(`delete from public.schedules where id = $1`, [row.id])).affectedRows, 0)
    }))

  test('teacher cannot move their schedule to an unassigned student', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [row] = await q(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      await rejects(run(`update public.schedules set student_id = $1 where id = $2`, [S(2), row.id]), '42501')
    }))

  test('end time must be after start time', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(...schedule(T1, S(1), '2026-10-01T10:00+07', '2026-10-01T09:00+07')), '23514', 'schedules_time_order')
    }))

  test('overlapping schedules for the same teacher are rejected; back-to-back is fine', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await run(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      await run(...schedule(T1, S(3), '2026-10-01T10:00+07', '2026-10-01T11:00+07'))
      await rejects(
        run(...schedule(T1, S(5), '2026-10-01T09:30+07', '2026-10-01T10:30+07')),
        '23P01',
        'schedules_no_teacher_overlap',
      )
    }))

  test('overlapping schedules for the same student are rejected, even across teachers', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await run(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      await as(U.t2)
      await rejects(
        run(...schedule(T2, S(1), '2026-10-01T09:30+07', '2026-10-01T10:30+07')),
        '23P01',
        'schedules_no_student_overlap',
      )
    }))
})

// =============================================================================
describe('payments', () => {
  const insertPayment = (teacher, student, month = '2026-09-01', status = 'unpaid') => [
    `insert into public.payments (student_id, teacher_id, billing_month, amount, status)
     values ($1, $2, $3, 1000000, $4) returning *`,
    [student, teacher, month, status],
  ]

  test('teacher marks an assigned student paid → paid_at, marked_by and history are recorded', () =>
    tx(async ({ as, q }) => {
      await as(U.t1)
      const [p] = await q(...insertPayment(T1, S(1)))
      assert.equal(p.paid_at, null)

      const [paid] = await q(`update public.payments set status = 'paid' where id = $1 returning *`, [p.id])
      assert.ok(paid.paid_at instanceof Date)
      assert.equal(paid.marked_by, U.t1)

      const [unpaid] = await q(`update public.payments set status = 'unpaid' where id = $1 returning *`, [p.id])
      assert.equal(unpaid.paid_at, null)

      const history = await q(`select old_status, new_status, changed_by from public.payment_history where payment_id = $1 order by id`, [p.id])
      assert.deepEqual(history.map((h) => [h.old_status, h.new_status, h.changed_by]), [
        [null, 'unpaid', U.t1],
        ['unpaid', 'paid', U.t1],
        ['paid', 'unpaid', U.t1],
      ])
    }))

  test('teacher cannot forge paid_at or marked_by', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [p] = await q(...insertPayment(T1, S(1)))
      await rejects(run(`update public.payments set paid_at = now() where id = $1`, [p.id]), '42501')
      await rejects(run(`update public.payments set marked_by = $1 where id = $2`, [U.t2, p.id]), '42501')
    }))

  test('admin can read payments but cannot create or update them', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [p] = await q(...insertPayment(T1, S(1)))
      await promoteAdmin(as, run)
      await as(U.admin)
      assert.equal((await q(`select id from public.payments`)).length, 1)
      assert.equal((await run(`update public.payments set status = 'paid' where id = $1`, [p.id])).affectedRows, 0)
      await rejects(run(...insertPayment(T1, S(3))), '42501')
    }))

  test('teacher cannot update another teacher’s payment or bill an unassigned student', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t2)
      const [p] = await q(...insertPayment(T2, S(2)))
      await as(U.t1)
      assert.equal((await run(`update public.payments set status = 'paid' where id = $1`, [p.id])).affectedRows, 0)
      await rejects(run(...insertPayment(T1, S(2))), '42501')
    }))

  test('one payment record per student, teacher and month; month must be the 1st', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await run(...insertPayment(T1, S(1)))
      await rejects(run(...insertPayment(T1, S(1))), '23505', 'payments_one_per_month')
      await rejects(run(...insertPayment(T1, S(3), '2026-09-15')), '23514')
    }))

  test('teachers cannot read each other’s payments or payment history', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t2)
      const [p] = await q(...insertPayment(T2, S(1))) // S1 is shared by T1 and T2
      await run(`update public.payments set status = 'paid' where id = $1`, [p.id])
      assert.equal((await q(`select id from public.payment_history where payment_id = $1`, [p.id])).length, 2)

      await as(U.t1)
      assert.equal((await q(`select id from public.payments where id = $1`, [p.id])).length, 0)
      assert.equal((await q(`select id from public.payment_history where payment_id = $1`, [p.id])).length, 0)

      await promoteAdmin(as, run)
      await as(U.admin)
      assert.equal((await q(`select id from public.payment_history where payment_id = $1`, [p.id])).length, 2)
    }))

  test('generate_monthly_payments bills assigned active students from scheduled hours', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      // 1.5 h + 1 h with S1 in September (Vietnam time) at 250,000 đ/h = 625,000 đ
      await run(...schedule(T1, S(1), '2026-09-10T09:00+07', '2026-09-10T10:30+07'))
      await run(...schedule(T1, S(1), '2026-09-12T09:00+07', '2026-09-12T10:00+07'))
      // 1 Oct 06:00 Vietnam = 30 Sep 23:00 UTC: must count as October, not September
      await run(...schedule(T1, S(1), '2026-10-01T06:00+07', '2026-10-01T07:00+07'))

      const [{ created }] = await q(`select public.generate_monthly_payments('2026-09-17') as created`)
      assert.equal(created, 3) // S1, S3, S5 (all active)
      const rows = await q(`select student_id, amount::int as amount, status from public.payments order by student_id`)
      assert.deepEqual(rows.find((r) => r.student_id === S(1)), { student_id: S(1), amount: 625000, status: 'unpaid' })
      assert.equal(rows.find((r) => r.student_id === S(3)).amount, 0)

      // Idempotent: running again creates nothing new
      const [{ created: again }] = await q(`select public.generate_monthly_payments('2026-09-01') as created`)
      assert.equal(again, 0)
    }))

  test('admin cannot generate payment records', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(`select public.generate_monthly_payments('2026-09-01')`), '42501')
    }))

  test('dashboard_summary is scoped by RLS: admin sees the centre, a teacher sees their own', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [p] = await q(
        `insert into public.payments (student_id, teacher_id, billing_month, amount) values ($1, $2, date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date, 100) returning id`,
        [S(1), T1],
      )
      await run(`update public.payments set status = 'paid' where id = $1`, [p.id])
      await as(U.t2)
      await run(
        `insert into public.payments (student_id, teacher_id, billing_month, amount) values ($1, $2, date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date, 100)`,
        [S(2), T2],
      )

      await promoteAdmin(as, run)
      await as(U.admin)
      const [{ s: admin }] = await q(`select public.dashboard_summary() as s`)
      assert.equal(admin.students, 5) // 6 seeded, 1 inactive
      assert.equal(admin.teachers, 3)
      assert.equal(admin.paid_students, 1)
      assert.equal(admin.unpaid_students, 1)
      assert.equal(admin.monthly.length, 6)

      await as(U.t1)
      const [{ s: teacher }] = await q(`select public.dashboard_summary() as s`)
      assert.equal(teacher.students, 3)
      assert.equal(teacher.teachers, 1)
      assert.equal(teacher.paid_students, 1)
      assert.equal(teacher.unpaid_students, 0) // T2's unpaid record is invisible to T1
    }))

  test('nobody can delete payments or write payment history through the API', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [p] = await q(...insertPayment(T1, S(1)))
      await rejects(run(`delete from public.payments where id = $1`, [p.id]), '42501')
      await rejects(
        run(`insert into public.payment_history (payment_id, new_status) values ($1, 'paid')`, [p.id]),
        '42501',
      )
    }))
})

// =============================================================================
// Production-readiness review: regression tests, one per finding (IDs match the review report).
// =============================================================================
describe('review findings', () => {
  const T3 = '11111111-1111-4111-8111-000000000003' // seeded, on_leave, no login yet
  const ATTACKER = 'bbbbbbbb-0000-4000-8000-000000000001'
  const payment = (teacher, student, extra = '') => [
    `insert into public.payments (student_id, teacher_id, billing_month, amount ${extra ? ', schedule_id' : ''})
     values ($1, $2, '2026-09-01', 1000000 ${extra ? ', $3' : ''}) returning *`,
    extra ? [student, teacher, extra] : [student, teacher],
  ]

  test('[SEC-1] an UNCONFIRMED sign-up with a teacher’s email is not linked and gets no access', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email) values ($1, 'teacher3@example.com')`, [ATTACKER])
      assert.equal((await q(`select profile_id from public.teachers where id = $1`, [T3]))[0].profile_id, null)
      await as(ATTACKER)
      assert.equal((await q(`select id from public.students`)).length, 0)
      // …and learns nothing about the teacher record (name is not copied before confirmation)
      assert.equal((await q(`select full_name from public.profiles where id = $1`, [ATTACKER]))[0].full_name, 'teacher3')

      // Confirming makes it a student login; only an admin switching it to teacher links the record.
      await as(SUPER)
      await run(`update auth.users set email_confirmed_at = now() where id = $1`, [ATTACKER])
      assert.equal((await q(`select profile_id from public.teachers where id = $1`, [T3]))[0].profile_id, null)
    }))

  test('[SEC-1] a teacher record created later is not linked to an unconfirmed login', () =>
    tx(async ({ as, q, run }) => {
      await as(SUPER)
      await run(`insert into auth.users (id, email) values ($1, 'late@example.com')`, [ATTACKER])
      await promoteAdmin(as, run)
      await as(U.admin)
      const [t] = await q(`insert into public.teachers (full_name, email) values ('Late', 'late@example.com') returning profile_id`)
      assert.equal(t.profile_id, null)
    }))

  test('[SEC-2] admin cannot delete schedules indirectly by deleting a student or teacher', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await run(...schedule(T1, S(3), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      await promoteAdmin(as, run)
      await as(U.admin)
      await rejects(run(`delete from public.students where id = $1`, [S(3)]), '23001')
      await rejects(run(`delete from public.teachers where id = $1`, [T1]), '23001')
    }))

  test('[SEC-3] a payment can only reference a schedule of the same teacher and student', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t2)
      const [foreign] = await q(...schedule(T2, S(2), '2026-09-05T09:00+07', '2026-09-05T10:00+07'))
      await as(U.t1)
      const [ownOther] = await q(...schedule(T1, S(3), '2026-09-06T09:00+07', '2026-09-06T10:00+07'))
      const [own] = await q(...schedule(T1, S(1), '2026-09-07T09:00+07', '2026-09-07T10:00+07'))
      await rejects(run(...payment(T1, S(1), foreign.id)), '23514')
      await rejects(run(...payment(T1, S(1), ownOther.id)), '23514')
      await run(...payment(T1, S(1), own.id))
    }))

  test('[PAY-1] amount is locked while paid, and history records the amount', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      const [p] = await q(...payment(T1, S(1)))
      await run(`update public.payments set status = 'paid' where id = $1`, [p.id])
      await rejects(run(`update public.payments set amount = 0 where id = $1`, [p.id]), '23514')
      await run(`update public.payments set notes = 'cash' where id = $1`, [p.id]) // other edits still fine
      await run(`update public.payments set status = 'unpaid' where id = $1`, [p.id])
      await run(`update public.payments set amount = 900000 where id = $1`, [p.id])
      const history = await q(`select new_status, amount::int as amount from public.payment_history where payment_id = $1 order by id`, [p.id])
      assert.deepEqual(history.map((h) => [h.new_status, h.amount]), [
        ['unpaid', 1000000],
        ['paid', 1000000],
        ['unpaid', 1000000],
      ])
    }))

  test('[SCH-1] moving an existing class onto another class is rejected (update path)', () =>
    tx(async ({ as, q, run }) => {
      await as(U.t1)
      await run(...schedule(T1, S(1), '2026-10-01T09:00+07', '2026-10-01T10:00+07'))
      const [later] = await q(...schedule(T1, S(3), '2026-10-01T11:00+07', '2026-10-01T12:00+07'))
      await rejects(
        run(`update public.schedules set start_time = '2026-10-01T09:30+07', end_time = '2026-10-01T10:30+07' where id = $1`, [later.id]),
        '23P01',
        'schedules_no_teacher_overlap',
      )
    }))

  test('[SEC-4] avatar_url must be an https URL', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(`update public.profiles set avatar_url = 'javascript:alert(1)' where id = $1`, [U.t1]), '23514')
      await run(`update public.profiles set avatar_url = 'https://example.com/a.png' where id = $1`, [U.t1])
    }))
})

// =============================================================================
describe('sign-up allowlist', () => {
  const NEWCOMER = 'cccccccc-0000-4000-8000-000000000001'
  const signUp = (email) => [`insert into auth.users (id, email) values ($1, $2)`, [NEWCOMER, email]]

  test('before any admin exists, anyone can be created (bootstraps the first admin)', () =>
    tx(async ({ as, run }) => {
      await as(SUPER)
      await run(...signUp('future-admin@example.com'))
    }))

  test('once an admin exists, an email with no teacher record is refused', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await rejects(run(...signUp('stranger@example.com')), '42501')
    }))

  test('once an admin exists, the email of an added teacher can sign up (case-insensitive)', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await run(...signUp('Teacher3@Example.com')) // seeded teacher, on_leave
    }))

  test('the email of an inactive teacher is refused', () =>
    tx(async ({ as, run }) => {
      await promoteAdmin(as, run)
      await run(`update public.teachers set status = 'inactive' where email = 'teacher3@example.com'`)
      await rejects(run(...signUp('teacher3@example.com')), '42501')
    }))
})

// =============================================================================
describe('profile theme', () => {
  test('new profiles default to the system theme', () =>
    tx(async ({ q }) => {
      const [p] = await q(`select theme from public.profiles where id = $1`, [U.t1])
      assert.equal(p.theme, 'system')
    }))

  test('a user can save their own theme', () =>
    tx(async ({ as, q }) => {
      await as(U.t1)
      const rows = await q(`update public.profiles set theme = 'dark' where id = $1 returning theme`, [U.t1])
      assert.deepEqual(rows, [{ theme: 'dark' }])
    }))

  test('a user cannot change someone else’s theme', () =>
    tx(async ({ as, q }) => {
      await as(U.t1)
      assert.equal((await q(`update public.profiles set theme = 'dark' where id = $1 returning id`, [U.t2])).length, 0)
    }))

  test('only light, dark or system are accepted', () =>
    tx(async ({ as, run }) => {
      await as(U.t1)
      await rejects(run(`update public.profiles set theme = 'purple' where id = $1`, [U.t1]), '23514')
    }))
})

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
