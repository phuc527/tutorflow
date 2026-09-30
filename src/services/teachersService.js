import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'
import { emptyToNull, ilikeAny, pageRange } from './query'

const LIST_COLUMNS =
  'id, full_name, email, phone, specialization, hourly_rate, status, profile_id, created_at, student_count:teacher_students(count)'

export const teachersService = {
  /** Paginated, filtered list. Returns { data, count }. */
  async list({ q = '', status = '', page = 1, pageSize = 10 }) {
    let query = supabase.from('teachers').select(LIST_COLUMNS, { count: 'exact' }).order('full_name')

    const search = ilikeAny(['full_name', 'email', 'specialization'], q)
    if (search) query = query.or(search)
    if (status) query = query.eq('status', status)

    const { data, count } = unwrap(await query.range(...pageRange(page, pageSize)))
    return {
      // PostgREST returns aggregated counts as [{ count: n }]
      data: data.map((row) => ({ ...row, student_count: row.student_count?.[0]?.count ?? 0 })),
      count,
    }
  },

  /** Lightweight list for dropdowns and filters. */
  async listOptions() {
    return unwrap(await supabase.from('teachers').select('id, full_name, status').order('full_name'))
  },

  async create(values) {
    return unwrap(await supabase.from('teachers').insert(emptyToNull(values)).select().single())
  },

  async update(id, values) {
    return unwrap(await supabase.from('teachers').update(emptyToNull(values)).eq('id', id).select().single())
  },

  async remove(id) {
    unwrap(await supabase.from('teachers').delete().eq('id', id))
  },
}
