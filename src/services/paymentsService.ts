import { supabase } from '@/lib/supabase'
import type { PaymentDetailsValues } from '@/schemas/payment'
import type { PaymentStatus } from '@/types/domain'
import { AppError, STALE_WRITE, toAppError, unwrap, unwrapPage } from './errors'
import { pageRange, type PageParams } from './query'

const COLUMNS = `
  id, student_id, teacher_id, billing_month, amount, status, paid_at, notes, updated_at,
  student:students(id, full_name, grade),
  teacher:teachers(id, full_name),
  marker:profiles!payments_marked_by_fkey(full_name)
`

export interface PaymentFilters {
  month: string
  status?: string
  teacherId?: string
  studentId?: string
}

export type PaymentListParams = PaymentFilters & PageParams

/** The version of a payment the user is looking at (see guardedUpdate). */
interface PaymentVersion {
  id: string
  updated_at: string
}

/**
 * Optimistic concurrency: only update the row if it is still the version the user was looking at
 * (same updated_at). If another tab or person changed it first, nothing is overwritten.
 */
async function guardedUpdate(payment: PaymentVersion, changes: { status?: PaymentStatus; amount?: number; notes?: string | null }) {
  const { data, error } = await supabase
    .from('payments')
    .update(changes)
    .eq('id', payment.id)
    .eq('updated_at', payment.updated_at)
    .select(COLUMNS)
  if (error) throw toAppError(error)
  const [updated] = data
  if (!updated) {
    throw new AppError('This payment was changed somewhere else. The list has been refreshed; please check it and try again.', {
      code: STALE_WRITE,
    })
  }
  return updated
}

function paymentsQuery<Q extends string>(columns: Q, { month, status, teacherId, studentId }: PaymentFilters, count?: 'exact') {
  let q = supabase.from('payments').select(columns, count ? { count } : undefined).eq('billing_month', month)
  if (status) q = q.eq('status', status)
  if (teacherId) q = q.eq('teacher_id', teacherId)
  if (studentId) q = q.eq('student_id', studentId)
  return q
}

export const paymentsService = {
  /** One billing month, paginated. Unpaid first so outstanding items are on top. */
  async list({ page = 1, pageSize = 10, ...filters }: PaymentListParams) {
    const query = paymentsQuery(COLUMNS, filters, 'exact')
      .order('status', { ascending: false }) // 'unpaid' > 'paid'
      .order('created_at')
      .order('id')
    return unwrapPage(await query.range(...pageRange(page, pageSize)))
  },

  /** Totals for the month under the same filters (except status), for the summary cards. */
  async monthTotals({ status: _ignored, ...filters }: PaymentFilters) {
    const rows = unwrap(await paymentsQuery('status, amount', filters))
    const totals: Record<PaymentStatus, { count: number; amount: number }> = {
      paid: { count: 0, amount: 0 },
      unpaid: { count: 0, amount: 0 },
    }
    for (const row of rows) {
      const bucket = totals[row.status as PaymentStatus]
      if (!bucket) continue
      bucket.count += 1
      bucket.amount += Number(row.amount)
    }
    return totals
  },

  /** Teacher only: create unpaid records for all assigned active students (migration 0006). */
  async generateForMonth(month: string) {
    return unwrap(await supabase.rpc('generate_monthly_payments', { p_billing_month: month }))
  },

  /** paid_at and marked_by are filled in by a database trigger; the client only sends the status. */
  async setStatus(payment: PaymentVersion, status: PaymentStatus) {
    return guardedUpdate(payment, { status })
  },

  async updateDetails(payment: PaymentVersion, { amount, notes }: PaymentDetailsValues) {
    return guardedUpdate(payment, { amount, notes: notes?.trim() ? notes.trim() : null })
  },

  async history(paymentId: string) {
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

export type Payment = Awaited<ReturnType<typeof paymentsService.list>>['data'][number]
export type PaymentTotals = Awaited<ReturnType<typeof paymentsService.monthTotals>>
export type PaymentHistoryEntry = Awaited<ReturnType<typeof paymentsService.history>>[number]
