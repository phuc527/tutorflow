import type { QueryData } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { StudentValues } from '@/schemas/student'
import type { PaymentStatus } from '@/types/domain'
import { currentBillingMonth } from '@/utils/datetime'
import { unwrap, unwrapPage } from './errors'
import { emptyToNull, ilikeAny, pageRange, type PageParams } from './query'

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

const OPTIONAL = ['email', 'phone', 'parent_name', 'parent_phone', 'notes'] as const

// The row shape of LIST_COLUMNS, inferred from the select string (the filter_ts variant adds nothing we keep).
const _listQueryShape = () => supabase.from('students').select(LIST_COLUMNS)
type StudentListRow = QueryData<ReturnType<typeof _listQueryShape>>[number]

export interface StudentListParams extends PageParams {
  q?: string
  status?: string
  grade?: string
  teacherId?: string
}

export const studentsService = {
  async list({ q = '', status = '', grade = '', teacherId = '', page = 1, pageSize = 10 }: StudentListParams) {
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

    const { data, count } = unwrapPage(
      await query.range(...pageRange(page, pageSize)).overrideTypes<StudentListRow[], { merge: false }>(),
    )
    return {
      data: data.map(({ assignments, payments, ...student }) => ({
        ...student,
        teachers: assignments.flatMap((a) => (a.teacher ? [a.teacher] : [])),
        paymentStatus: summarizePayments(payments),
      })),
      count,
    }
  },

  async listOptions() {
    return unwrap(await supabase.from('students').select('id, full_name, grade, status').order('full_name'))
  },

  async create(values: StudentValues) {
    return unwrap(await supabase.from('students').insert(emptyToNull(values, OPTIONAL)).select().single())
  },

  async update(id: string, values: StudentValues) {
    return unwrap(await supabase.from('students').update(emptyToNull(values, OPTIONAL)).eq('id', id).select().single())
  },

  async remove(id: string) {
    unwrap(await supabase.from('students').delete().eq('id', id))
  },

  async getTeacherIds(studentId: string) {
    const rows = unwrap(await supabase.from('teacher_students').select('teacher_id').eq('student_id', studentId))
    return rows.map((row) => row.teacher_id)
  },

  /** Atomic replace of the student's teachers (see migration 0005). */
  async setTeachers(studentId: string, teacherIds: string[]) {
    unwrap(await supabase.rpc('set_student_teachers', { p_student_id: studentId, p_teacher_ids: teacherIds }))
  },
}

/** This month's payment state across a student's teachers: 'unpaid' if any is unpaid, 'paid' if all paid. */
function summarizePayments(payments: { status: string }[] = []): PaymentStatus | null {
  if (!payments.length) return null
  return payments.some((p) => p.status === 'unpaid') ? 'unpaid' : 'paid'
}

export type StudentListItem = Awaited<ReturnType<typeof studentsService.list>>['data'][number]
export type StudentOption = Awaited<ReturnType<typeof studentsService.listOptions>>[number]
