import { supabase } from '@/lib/supabase'
import { AppError, STALE_WRITE, toAppError, unwrap } from './errors'
import { pageRange } from './query'

const COLUMNS = `
  id, student_id, teacher_id, billing_month, amount, status, paid_at, notes, updated_at,
  student:students(id, full_name, grade),
  teacher:teachers(id, full_name),
  marker:profiles!payments_marked_by_fkey(full_name)
`

/**
 * Optimistic concurrency: only update the row if it is still the version the user was looking at
 * (same updated_at). If another tab or person changed it first, nothing is overwritten.
 */
async function guardedUpdate(payment, changes) {
  const { data, error } = await supabase
    .from('payments')
    .update(changes)
    .eq('id', payment.id)
    .eq('updated_at', payment.updated_at)
    .select(COLUMNS)
  if (error) throw toAppError(error)
  if (!data.length) {
    throw new AppError('This payment was changed somewhere else. The list has been refreshed; please check it and try again.', {
      code: STALE_WRITE,
    })
  }
  return data[0]
}

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
  async setStatus(payment, status) {
    return guardedUpdate(payment, { status })
  },

  async updateDetails(payment, { amount, notes }) {
    return guardedUpdate(payment, { amount, notes: notes?.trim() ? notes.trim() : null })
  },

  async history(paymentId) {
    return unwrap(
      await supabase
        .from('payment_history')
        .select('id, old_status, new_status, amount, changed_at, changer:profiles(full_name)')
        .eq('payment_id', paymentId)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false }),
    )
  },
}
