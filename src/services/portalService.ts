import { supabase } from '@/lib/supabase'
import { unwrap } from './errors'

/** Student-only read functions (migration 0010). They return nothing for other roles. */
export const portalService = {
  async myStudents() {
    return unwrap(await supabase.rpc('my_students'))
  },

  /** Classes overlapping [from, to) (ISO instants); the database caps the range at 100 days. */
  async mySchedule({ from, to }: { from: string; to: string }) {
    return unwrap(await supabase.rpc('my_schedule', { p_from: from, p_to: to }))
  },

  async myPayments() {
    return unwrap(await supabase.rpc('my_payments'))
  },
}

export type PortalStudent = Awaited<ReturnType<typeof portalService.myStudents>>[number]
export type PortalClass = Awaited<ReturnType<typeof portalService.mySchedule>>[number]
export type PortalPayment = Awaited<ReturnType<typeof portalService.myPayments>>[number]
