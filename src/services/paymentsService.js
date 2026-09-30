import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'
import { pageRange } from './query'

const COLUMNS = `
  id, student_id, teacher_id, billing_month, amount, status, paid_at, notes, updated_at,
  student:students(id, full_name, grade),
  teacher:teachers(id, full_name),
  marker:profiles!payments_marked_by_fkey(full_name)
`

function applyFilters(query, { month, status, teacherId, studentId }) {
  let q = query.eq('billing_month', month)
  if (status) q = q.eq('status', status)
  if (teacherId) q = q.eq('teacher_id', teacherId)
  if (studentId) q = q.eq('student_id', studentId)
  return q
}

export const paymentsService = {
  /** One billing month, paginated. Unpaid first so outstanding items are on top. */
  async list({ page = 1, pageSize = 10, ...filters }) {
    const query = applyFilters(supabase.from('payments').select(COLUMNS, { count: 'exact' }), filters)
      .order('status', { ascending: false }) // 'unpaid' > 'paid'
      .order('created_at')
      .order('id')
    return unwrap(await query.range(...pageRange(page, pageSize)))
  },

  /** Totals for the month under the same filters (except status), for the summary cards. */
  async monthTotals({ status: _ignored, ...filters }) {
    const rows = unwrap(await applyFilters(supabase.from('payments').select('status, amount'), filters))
    const totals = { paid: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0 } }
    for (const row of rows) {
      totals[row.status].count += 1
      totals[row.status].amount += Number(row.amount)
    }
    return totals
  },

  /** Teacher only: create unpaid records for all assigned active students (migration 0006). */
  async generateForMonth(month) {
    return unwrap(await supabase.rpc('generate_monthly_payments', { p_billing_month: month }))
  },

  /** paid_at and marked_by are filled in by a database trigger; the client only sends the status. */
  async setStatus(id, status) {
    return unwrap(await supabase.from('payments').update({ status }).eq('id', id).select(COLUMNS).single())
  },

  async updateDetails(id, { amount, notes }) {
    return unwrap(
      await supabase
        .from('payments')
        .update({ amount, notes: notes?.trim() ? notes.trim() : null })
        .eq('id', id)
        .select(COLUMNS)
        .single(),
    )
  },

  async history(paymentId) {
    return unwrap(
      await supabase
        .from('payment_history')
        .select('id, old_status, new_status, changed_at, changer:profiles(full_name)')
        .eq('payment_id', paymentId)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false }),
    )
  },
}
