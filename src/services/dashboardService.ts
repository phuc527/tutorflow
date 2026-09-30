import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'

/** One month of the payment trend (numbers arrive from jsonb; amounts may be numeric strings). */
export interface MonthlyPayments {
  billing_month: string
  paid_amount: number | string
  unpaid_amount: number | string
  paid_count: number
  unpaid_count: number
}

/** The jsonb object built by public.dashboard_summary (migration 0006). */
export interface DashboardSummary {
  today: string
  billing_month: string
  teachers: number
  students: number
  today_classes: number
  paid_students: number
  unpaid_students: number
  monthly: MonthlyPayments[] | null
}

export const dashboardService = {
  /** All stat numbers in one call; scoped by RLS to what the caller may see (migration 0006). */
  async summary() {
    // The function returns jsonb, which the generated types only know as Json.
    return unwrap(await supabase.rpc('dashboard_summary', { p_months: 6 })) as unknown as DashboardSummary
  },

  async upcomingClasses(limit = 6) {
    return unwrap(
      await supabase
        .from('schedules')
        .select('id, title, subject, start_time, end_time, location, teacher_id, teacher:teachers(full_name), student:students(full_name)')
        .gte('end_time', new Date().toISOString())
        .order('start_time')
        .limit(limit),
    )
  },
}

export type UpcomingClass = Awaited<ReturnType<typeof dashboardService.upcomingClasses>>[number]
