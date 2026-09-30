import { supabase } from '@/lib/supabase'
import type { TeacherValues } from '@/schemas/teacher'
import { unwrap, unwrapPage } from './errors'
import { emptyToNull, ilikeAny, pageRange, type PageParams } from './query'

const LIST_COLUMNS =
  'id, full_name, email, phone, specialization, hourly_rate, status, profile_id, created_at, student_count:teacher_students(count)'

const OPTIONAL = ['phone', 'specialization'] as const

export interface TeacherListParams extends PageParams {
  q?: string
  status?: string
}

export const teachersService = {
  /** Paginated, filtered list. Returns { data, count }. */
  async list({ q = '', status = '', page = 1, pageSize = 10 }: TeacherListParams) {
    let query = supabase.from('teachers').select(LIST_COLUMNS, { count: 'exact' }).order('full_name')

    const search = ilikeAny(['full_name', 'email', 'specialization'], q)
    if (search) query = query.or(search)
    if (status) query = query.eq('status', status)

    const { data, count } = unwrapPage(await query.range(...pageRange(page, pageSize)))
    return {
      // PostgREST returns aggregated counts as [{ count: n }]
      data: data.map((row) => ({ ...row, student_count: row.student_count[0]?.count ?? 0 })),
      count,
    }
  },

  /** Lightweight list for dropdowns and filters. */
  async listOptions() {
    return unwrap(await supabase.from('teachers').select('id, full_name, status').order('full_name'))
  },

  /** Ids of the students assigned to a teacher. */
  async getStudentIds(teacherId: string) {
    const rows = unwrap(await supabase.from('teacher_students').select('student_id').eq('teacher_id', teacherId))
    return rows.map((row) => row.student_id)
  },

  async create(values: TeacherValues) {
    return unwrap(await supabase.from('teachers').insert(emptyToNull(values, OPTIONAL)).select().single())
  },

  async update(id: string, values: TeacherValues) {
    return unwrap(await supabase.from('teachers').update(emptyToNull(values, OPTIONAL)).eq('id', id).select().single())
  },

  async remove(id: string) {
    unwrap(await supabase.from('teachers').delete().eq('id', id))
  },
}

export type TeacherListItem = Awaited<ReturnType<typeof teachersService.list>>['data'][number]
export type TeacherOption = Awaited<ReturnType<typeof teachersService.listOptions>>[number]
