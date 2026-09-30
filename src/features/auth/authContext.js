import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** Current session, profile and role, plus signIn/signOut. Must be used inside <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
