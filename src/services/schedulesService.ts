import { supabase } from '@/lib/supabase'
import type { ScheduleValues } from '@/schemas/schedule'
import { toUtcISO } from '@/utils/datetime'
import { unwrap } from './errors'
import { emptyToNull } from './query'

const COLUMNS = `
  id, teacher_id, student_id, title, subject, start_time, end_time, location, notes, created_at,
  teacher:teachers(id, full_name),
  student:students(id, full_name, grade)
`

const OPTIONAL = ['location', 'notes'] as const

export interface ScheduleRangeParams {
  from: Date
  to: Date
  teacherId?: string
  studentId?: string
}

export const schedulesService = {
  /**
   * Schedules overlapping [from, to): start < to AND end > from.
   * RLS decides whose schedules come back (admin: all, teacher: own).
   */
  async listInRange({ from, to, teacherId, studentId }: ScheduleRangeParams) {
    let query = supabase
      .from('schedules')
      .select(COLUMNS)
      .lt('start_time', toUtcISO(to))
      .gt('end_time', toUtcISO(from))
      .order('start_time')
    if (teacherId) query = query.eq('teacher_id', teacherId)
    if (studentId) query = query.eq('student_id', studentId)
    return unwrap(await query)
  },

  /**
   * A teacher passes their own teacher id; the admin passes the chosen one. RLS requires the student to
   * be assigned to that teacher. created_by is set by the database.
   */
  async create(teacherId: string, { teacher_id: _teacherId, ...values }: ScheduleValues) {
    return unwrap(
      await supabase
        .from('schedules')
        .insert({ ...emptyToNull(values, OPTIONAL), teacher_id: teacherId })
        .select(COLUMNS)
        .single(),
    )
  },

  /** teacher_id is fixed after creation (not an updatable column). */
  async update(id: string, { teacher_id: _teacherId, ...values }: ScheduleValues) {
    return unwrap(
      await supabase.from('schedules').update(emptyToNull(values, OPTIONAL)).eq('id', id).select(COLUMNS).single(),
    )
  },

  async remove(id: string) {
    unwrap(await supabase.from('schedules').delete().eq('id', id))
  },
}

/** A schedule as loaded for the calendar (with teacher and student names). */
export type Schedule = Awaited<ReturnType<typeof schedulesService.listInRange>>[number]
