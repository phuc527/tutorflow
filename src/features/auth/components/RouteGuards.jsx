import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErrorState, FullPageSpinner } from '@/components/common/States'
import { useAuth } from '../authContext'

/**
 * Layout route: children render only for a logged-in user with a loaded profile.
 * Logged-out visitors are sent to /login, remembering where they were going.
 */
export function RequireAuth() {
  const { session, profile, isLoading, profileError, refetchProfile, signOut } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  // Logged in but the profile couldn't be read (network error, or the profile row is missing).
  if (profileError || !profile) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center">
        <ErrorState
          title="Couldn't load your account"
          error={profileError ?? { message: 'Your account has no profile. Contact the administrator.' }}
          onRetry={refetchProfile}
        />
        <Button variant="link" onClick={signOut}>
          Sign out
        </Button>
      </div>
    )
  }

  return <Outlet />
}

/**
 * Layout route: children render only for the listed roles; others go to /unauthorized.
 * This is a UX guard. Even if bypassed, RLS still refuses the data.
 */
export function RequireRole({ roles }) {
  const { role } = useAuth()
  if (!roles.includes(role)) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}

/** For /login and /signup: already-authenticated users are bounced to the app. */
export function GuestOnly() {
  const { session, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  // Return to the page (including its filters in the query string) the user originally asked for.
  const from = location.state?.from
  if (session) return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/dashboard'} replace />
  return <Outlet />
}
