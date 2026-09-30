import { describe, expect, test } from 'vitest'
import { formToSchedule, scheduleSchema, scheduleToForm } from './schedule'
import { studentSchema } from './student'
import { teacherSchema } from './teacher'
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
    expect(result.error.issues[0].path).toEqual(['end'])
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
    expect(emptyToNull(parsed).email).toBeNull()
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
