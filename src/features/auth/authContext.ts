import { createContext, useContext } from 'react'
import type { AuthResponse, AuthTokenResponsePassword, Session, User } from '@supabase/supabase-js'
import type { LoginValues } from '@/schemas/auth'
import type { CurrentProfile, SignUpDetails } from '@/services/authService'
import type { AppError } from '@/services/errors'
import type { Role } from '@/types/domain'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: CurrentProfile | null
  role: Role | null
  /** The caller's teacher record id (null for admins, students and unlinked logins). */
  teacherId: string | null
  isLoading: boolean
  profileError: AppError | null
  refetchProfile: () => void
  signIn: (credentials: LoginValues) => Promise<AuthTokenResponsePassword['data']>
  signUp: (details: SignUpDetails) => Promise<AuthResponse['data']>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Current session, profile and role, plus signIn/signUp/signOut. Must be used inside <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
