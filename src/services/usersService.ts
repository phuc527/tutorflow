import { supabase } from '@/lib/supabase'
import type { Role } from '@/types/domain'
import { unwrap } from './errors'

// Admin only (RLS: admins read every profile and every student link).
const COLUMNS = `
  id, email, full_name, role, created_at,
  teacher:teachers!teachers_profile_id_fkey(id, full_name),
  studentLinks:student_accounts(student:students(id, full_name))
`

export const usersService = {
  async list() {
    return unwrap(await supabase.from('profiles').select(COLUMNS).order('created_at'))
  },

  /** Student ↔ teacher only; the database refuses admin, your own account and other admins. */
  async setRole(userId: string, role: Exclude<Role, 'admin'>) {
    return unwrap(await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role }))
  },

  async linkStudent(profileId: string, studentId: string) {
    return unwrap(await supabase.rpc('link_student_account', { p_profile_id: profileId, p_student_id: studentId }))
  },

  async unlinkStudent(profileId: string, studentId: string) {
    return unwrap(await supabase.rpc('unlink_student_account', { p_profile_id: profileId, p_student_id: studentId }))
  },
}

export type UserAccount = Awaited<ReturnType<typeof usersService.list>>[number]
