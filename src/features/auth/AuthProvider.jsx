import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/authService'
import { AuthContext } from './authContext'

const profileQueryKey = (userId) => ['auth', 'profile', userId]

/**
 * Two layers of state:
 *   session (who is logged in): owned by Supabase Auth, pushed to us via onAuthStateChange
 *   profile (their role etc.): server data, fetched with TanStack Query once we know the user id
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  // undefined = still restoring from storage; null = logged out
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    return authService.onAuthStateChange((event, nextSession) => {
      // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the auth client.
      setSession(nextSession)
      // Never let one user's cached data leak into the next user's session.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
  }, [queryClient])

  const userId = session?.user?.id
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => authService.fetchCurrentProfile(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback((credentials) => authService.signIn(credentials), [])
  const signOut = useCallback(() => authService.signOut(), [])

  const value = useMemo(() => {
    const profile = profileQuery.data ?? null
    return {
      session: session ?? null,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      teacherId: profile?.teacher?.id ?? null,
      isLoading: session === undefined || (Boolean(userId) && profileQuery.isPending),
      profileError: profileQuery.error,
      refetchProfile: profileQuery.refetch,
      signIn,
      signOut,
    }
  }, [session, userId, profileQuery.data, profileQuery.isPending, profileQuery.error, profileQuery.refetch, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
