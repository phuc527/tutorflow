import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { asRole } from '@/constants/roles'
import type { LoginValues } from '@/schemas/auth'
import { authService, type SignUpDetails } from '@/services/authService'
import { AuthContext, type AuthContextValue } from './authContext'

export const profileQueryKey = (userId: string | undefined) => ['auth', 'profile', userId]

/**
 * Two layers of state:
 *   session (who is logged in): owned by Supabase Auth, pushed to us via onAuthStateChange
 *   profile (their role etc.): server data, fetched with TanStack Query once we know the user id
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // undefined = still restoring from storage; null = logged out
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const lastUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    return authService.onAuthStateChange((_event, nextSession) => {
      // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the auth client.
      const nextUserId = nextSession?.user?.id ?? null
      // Never let one user's cached data leak into the next user's session. Clearing on any change of
      // user (not only SIGNED_OUT) also covers a session switching directly from one user to another.
      if (lastUserId.current !== undefined && lastUserId.current !== nextUserId) queryClient.clear()
      lastUserId.current = nextUserId
      setSession(nextSession)
    })
  }, [queryClient])

  const userId = session?.user?.id
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => authService.fetchCurrentProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    // Re-check role / teacher status when the user comes back to the tab, so a deactivation or role
    // change reaches the UI promptly. (The database enforces it immediately either way.)
    refetchOnWindowFocus: true,
  })

  const signIn = useCallback((credentials: LoginValues) => authService.signIn(credentials), [])
  const signUp = useCallback((details: SignUpDetails) => authService.signUp(details), [])
  const signOut = useCallback(() => authService.signOut(), [])

  const value = useMemo<AuthContextValue>(() => {
    const profile = profileQuery.data ?? null
    return {
      session: session ?? null,
      user: session?.user ?? null,
      profile,
      role: asRole(profile?.role),
      teacherId: profile?.teacher?.id ?? null,
      isLoading: session === undefined || (Boolean(userId) && profileQuery.isPending),
      profileError: profileQuery.error,
      refetchProfile: profileQuery.refetch,
      signIn,
      signUp,
      signOut,
    }
  }, [session, userId, profileQuery.data, profileQuery.isPending, profileQuery.error, profileQuery.refetch, signIn, signUp, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
