import { supabase } from '@/lib/supabase'
import { currentBillingMonth } from '@/utils/datetime'
import { unwrap } from './errors'
import { emptyToNull, ilikeAny, pageRange } from './query'

/*
  The same relation is embedded twice under different aliases:
    assignments:  every teacher of the student (for display)
    filter_ts:    an !inner join used only to filter by one teacher; it doesn't limit `assignments`
  `payments` is narrowed to the current billing month, giving the payment indicator.
  RLS shapes all of it: a teacher gets only their assigned students, and only their own payments.
*/
const LIST_COLUMNS = `
  id, full_name, email, phone, parent_name, parent_phone, grade, status, notes, created_at,
  assignments:teacher_students(teacher:teachers(id, full_name)),
  payments(status, billing_month)
`

export const studentsService = {
  async list({ q = '', status = '', grade = '', teacherId = '', page = 1, pageSize = 10 }) {
    const columns = teacherId ? `${LIST_COLUMNS}, filter_ts:teacher_students!inner(teacher_id)` : LIST_COLUMNS
    let query = supabase
      .from('students')
      .select(columns, { count: 'exact' })
      .eq('payments.billing_month', currentBillingMonth())
      .order('full_name')

    const search = ilikeAny(['full_name', 'parent_name', 'email', 'phone', 'parent_phone'], q)
    if (search) query = query.or(search)
    if (status) query = query.eq('status', status)
    if (grade) query = query.eq('grade', Number(grade))
    if (teacherId) query = query.eq('filter_ts.teacher_id', teacherId)

    const { data, count } = unwrap(await query.range(...pageRange(page, pageSize)))
    return {
      data: data.map(({ assignments, payments, filter_ts: _filter, ...student }) => ({
        ...student,
        teachers: assignments.map((a) => a.teacher).filter(Boolean),
        paymentStatus: summarizePayments(payments),
      })),
      count,
    }
  },

  async listOptions() {
    return unwrap(await supabase.from('students').select('id, full_name, grade, status').order('full_name'))
  },

  async create(values) {
    return unwrap(await supabase.from('students').insert(emptyToNull(values)).select().single())
  },

  async update(id, values) {
    return unwrap(await supabase.from('students').update(emptyToNull(values)).eq('id', id).select().single())
  },

  async remove(id) {
    unwrap(await supabase.from('students').delete().eq('id', id))
  },

  async getTeacherIds(studentId) {
    const rows = unwrap(await supabase.from('teacher_students').select('teacher_id').eq('student_id', studentId))
    return rows.map((row) => row.teacher_id)
  },

  /** Atomic replace of the student's teachers (see migration 0005). */
  async setTeachers(studentId, teacherIds) {
    unwrap(await supabase.rpc('set_student_teachers', { p_student_id: studentId, p_teacher_ids: teacherIds }))
  },
}

/** This month's payment state across a student's teachers: 'unpaid' if any is unpaid, 'paid' if all paid. */
function summarizePayments(payments = []) {
  if (!payments.length) return null
  return payments.some((p) => p.status === 'unpaid') ? 'unpaid' : 'paid'
}
