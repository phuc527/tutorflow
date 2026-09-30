import { supabase } from '@/lib/supabase'
import { toAppError, unwrap } from './errors'

export const authService = {
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw toAppError(error)
    return data
  },

  async signOut() {
    // 'local' revokes this device's session on the server and removes it from this browser.
    // If the server can't be reached, supabase-js keeps the session, so tell the user plainly
    // instead of pretending they are signed out.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      const appError = toAppError(error)
      appError.message = `Sign-out failed: ${appError.message} You are still signed in on this device.`
      throw appError
    }
  },

  /**
   * Subscribe to login/logout/token-refresh events. Fires INITIAL_SESSION right away with the
   * session restored from localStorage, which is what makes a page refresh keep you logged in.
   * Returns an unsubscribe function.
   */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(callback)
    return () => data.subscription.unsubscribe()
  },

  /**
   * The signed-in user's profile, read from the database (RLS: users can read their own row).
   * The role comes from here, never from anything the browser could edit.
   * `teacher` is the linked teacher record (null for admins or unlinked logins).
   */
  async fetchCurrentProfile(userId) {
    return unwrap(
      await supabase
        .from('profiles')
        // `!teachers_profile_id_fkey` names the FK to follow, so the embed can't become ambiguous later.
        .select('id, email, full_name, role, phone, avatar_url, teacher:teachers!teachers_profile_id_fkey(id, full_name, status)')
        .eq('id', userId)
        .single(),
    )
  },
}
