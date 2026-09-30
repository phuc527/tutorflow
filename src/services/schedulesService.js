import { supabase } from '@/lib/supabase'
import { toUtcISO } from '@/utils/datetime'
import { unwrap } from './errors'
import { emptyToNull } from './query'

const COLUMNS = `
  id, teacher_id, student_id, title, subject, start_time, end_time, location, notes, created_at,
  teacher:teachers(id, full_name),
  student:students(id, full_name, grade)
`

export const schedulesService = {
  /**
   * Schedules overlapping [from, to): start < to AND end > from.
   * RLS decides whose schedules come back (admin: all, teacher: own).
   */
  async listInRange({ from, to, teacherId, studentId }) {
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
  async create(teacherId, values) {
    return unwrap(
      await supabase
        .from('schedules')
        .insert({ ...emptyToNull(values), teacher_id: teacherId })
        .select(COLUMNS)
        .single(),
    )
  },

  /** teacher_id is fixed after creation (not an updatable column). */
  async update(id, { teacher_id: _teacherId, ...values }) {
    return unwrap(await supabase.from('schedules').update(emptyToNull(values)).eq('id', id).select(COLUMNS).single())
  },

  async remove(id) {
    unwrap(await supabase.from('schedules').delete().eq('id', id))
  },
}
