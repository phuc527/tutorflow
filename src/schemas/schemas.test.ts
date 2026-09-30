import { describe, expect, test } from 'vitest'
import { formToSchedule, scheduleSchema, scheduleToForm } from './schedule'
import { studentSchema } from './student'
import { teacherSchema } from './teacher'
import { signupSchema } from './auth'
import { toAppError } from '@/services/errors'
import { emptyToNull, ilikeAny, pageRange } from '@/services/query'

const STUDENT_ID = '22222222-2222-4222-8222-000000000001'
const validSchedule = {
  student_id: STUDENT_ID,
  title: 'Algebra',
  subject: 'Math',
  date: '2026-10-01',
  start: '09:00',
  end: '10:30',
  location: '',
  notes: '',
}

describe('schedule form', () => {
  test('rejects an end time that is not after the start', () => {
    const result = scheduleSchema.safeParse({ ...validSchedule, end: '09:00' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['end'])
  })

  test('form values become UTC instants read as Vietnam wall time, and back', () => {
    const row = formToSchedule(scheduleSchema.parse(validSchedule))
    expect(row.start_time).toBe('2026-10-01T02:00:00.000Z')
    expect(row.end_time).toBe('2026-10-01T03:30:00.000Z')
    expect(scheduleToForm({ ...row, student_id: STUDENT_ID, location: null, notes: null })).toEqual(validSchedule)
  })
})

describe('teacher and student forms', () => {
  test('teacher: coerces rate, validates email and phone', () => {
    const base = { full_name: 'Test Teacher', email: 't@example.com', phone: '', specialization: '', status: 'active' }
    expect(teacherSchema.parse({ ...base, hourly_rate: '250000' }).hourly_rate).toBe(250000)
    expect(teacherSchema.safeParse({ ...base, hourly_rate: '-1' }).success).toBe(false)
    expect(teacherSchema.safeParse({ ...base, email: 'nope', hourly_rate: 0 }).success).toBe(false)
    expect(teacherSchema.safeParse({ ...base, phone: 'abc', hourly_rate: 0 }).success).toBe(false)
  })

  test('student: empty grade becomes null, optional email may be blank', () => {
    const parsed = studentSchema.parse({
      full_name: 'Test Student',
      email: '',
      phone: '',
      parent_name: '',
      parent_phone: '0987 000 001',
      grade: '',
      status: 'active',
      notes: '',
    })
    expect(parsed.grade).toBeNull()
    expect(emptyToNull(parsed, ['email', 'phone']).email).toBeNull()
    // Only the listed optional columns are converted.
    expect(emptyToNull(parsed, ['phone']).email).toBe('')
  })
})

describe('service helpers', () => {
  test('search input cannot inject PostgREST filter syntax', () => {
    expect(ilikeAny(['full_name', 'email'], 'an')).toBe('full_name.ilike.%an%,email.ilike.%an%')
    // ')' and ',' are stripped, so the text stays one harmless ilike value instead of a second filter
    expect(ilikeAny(['full_name'], 'x),role.eq.admin')).toBe('full_name.ilike.%x  role.eq.admin%')
    expect(ilikeAny(['full_name'], '  ')).toBeNull()
  })

  test('page ranges are inclusive', () => {
    expect(pageRange(1, 10)).toEqual([0, 9])
    expect(pageRange(3, 10)).toEqual([20, 29])
  })

  test('database errors become friendly messages', () => {
    const overlap = { code: '23P01', message: 'conflicting key value violates exclusion constraint "schedules_no_student_overlap"' }
    expect(toAppError(overlap).message).toMatch(/student already has a class/)
    expect(toAppError({ code: '42501', message: 'new row violates row-level security policy' }).message).toMatch(/permission/)
    expect(toAppError({ code: '23001', message: 'restrict' }).message).toMatch(/inactive/i)
  })
})

describe('review fixes: form validation', () => {
  test('[FE-5] schedule longer than 12 hours is rejected in the form', () => {
    const result = scheduleSchema.safeParse({ ...validSchedule, start: '07:00', end: '19:30' })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((i) => i.message)).toContain('A class cannot be longer than 12 hours')
    expect(scheduleSchema.safeParse({ ...validSchedule, start: '07:00', end: '19:00' }).success).toBe(true)
  })

  test('[FE-6] blank hourly rate is an error instead of silently 0', () => {
    const base = { full_name: 'Test Teacher', email: 't@example.com', phone: '', specialization: '', status: 'active' }
    expect(teacherSchema.safeParse({ ...base, hourly_rate: '' }).success).toBe(false)
    expect(teacherSchema.parse({ ...base, hourly_rate: '0' }).hourly_rate).toBe(0)
    expect(teacherSchema.parse({ ...base, hourly_rate: 250000 }).hourly_rate).toBe(250000)
  })

  test('new database errors map to specific messages', () => {
    expect(toAppError({ code: '23514', message: 'x', details: 'payments_amount_locked' }).message).toMatch(/Mark it unpaid first/)
    expect(toAppError({ code: '23001', message: 'violates RESTRICT setting of foreign key constraint "schedules_student_id_fkey"' }).message).toMatch(/classes on the calendar/)
  })
})

describe('sign-up', () => {
  const valid = { fullName: 'Nguyễn Văn An', email: ' teacher1@example.com ', password: 'secret123', confirmPassword: 'secret123' }

  test('accepts a valid form and trims the email', () => {
    expect(signupSchema.parse(valid).email).toBe('teacher1@example.com')
  })

  test('requires a password of at least 8 characters', () => {
    const result = signupSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.path).toEqual(['password'])
  })

  test('rejects a confirmation that does not match, on the confirmPassword field', () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: 'secret124' })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.path).toEqual(['confirmPassword'])
  })

  test('requires a full name', () => {
    expect(signupSchema.safeParse({ ...valid, fullName: ' ' }).success).toBe(false)
  })

  test('a sign-up refused by the database allowlist gets an actionable message', () => {
    const refused = { name: 'AuthApiError', __isAuthError: true, status: 500, code: 'unexpected_failure', message: 'Database error saving new user' }
    expect(toAppError(refused).message).toMatch(/isn’t registered with your tutoring center/)
  })

  test('role management refusals get specific messages', () => {
    expect(toAppError({ code: '42501', message: 'x', details: 'role_self' }).message).toMatch(/your own role/)
    expect(toAppError({ code: '42501', message: 'x', details: 'role_admin_target' }).message).toMatch(/in the database/)
  })
})
