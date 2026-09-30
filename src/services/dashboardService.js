import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'

export const dashboardService = {
  /** All stat numbers in one call; scoped by RLS to what the caller may see (migration 0006). */
  async summary() {
    return unwrap(await supabase.rpc('dashboard_summary', { p_months: 6 }))
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
