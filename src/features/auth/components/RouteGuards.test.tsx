// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '../authContext'
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from './RouteGuards'

/*
  [TEST-1] Route guards: the UX layer of RBAC. (The database layer is tested in supabase/tests.)
  Each test renders a tiny router with a fake auth state and checks where the user ends up.
*/
afterEach(cleanup)

const session = { user: { id: 'u1' } }
const teacher = { id: 'u1', email: 't@example.com', full_name: 'T', role: 'teacher' }
const admin = { ...teacher, role: 'admin' }

function renderAt(path: string, auth: { session?: unknown; profile?: { role: string } | null; isLoading?: boolean }) {
  const value = {
    session: null,
    profile: null,
    role: auth.profile?.role ?? null,
    isLoading: false,
    profileError: null,
    refetchProfile: () => {},
    signOut: () => {},
    ...auth,
  } as unknown as AuthContextValue
  const router = createMemoryRouter(
    [
      { element: <GuestOnly />, children: [{ path: '/login', element: <p>login page</p> }] },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          { path: '/my/classes', element: <p>my classes page</p> },
          { path: '/dashboard', element: <p>dashboard page</p> },
          { path: '/payments', element: <p>payments page</p> },
          { element: <RequireRole roles={['admin']} />, children: [{ path: '/teachers', element: <p>teachers page</p> }] },
          { path: '/unauthorized', element: <p>unauthorized page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

describe('route guards', () => {
  test('the home page sends a student to their classes and staff to the dashboard', async () => {
    renderAt('/', { session, profile: { ...teacher, role: 'student' } })
    expect(await screen.findByText('my classes page')).toBeTruthy()
    cleanup()
    renderAt('/', { session, profile: admin })
    expect(await screen.findByText('dashboard page')).toBeTruthy()
  })

  test('a student opening a staff page is sent to /unauthorized', async () => {
    renderAt('/teachers', { session, profile: { ...teacher, role: 'student' } })
    expect(await screen.findByText('unauthorized page')).toBeTruthy()
  })

  test('logged-out visitor is sent to /login (scenario 13)', async () => {
    renderAt('/payments', {})
    expect(await screen.findByText('login page')).toBeTruthy()
  })

  test('teacher opening an admin-only page is sent to /unauthorized (scenario 13)', async () => {
    renderAt('/teachers', { session, profile: teacher })
    expect(await screen.findByText('unauthorized page')).toBeTruthy()
  })

  test('admin can open the admin-only page', async () => {
    renderAt('/teachers', { session, profile: admin })
    expect(await screen.findByText('teachers page')).toBeTruthy()
  })

  test('while the session is restoring nothing protected is shown (refresh keeps the session, scenario 14)', () => {
    renderAt('/payments', { isLoading: true })
    expect(screen.queryByText('payments page')).toBeNull()
    expect(screen.queryByText('login page')).toBeNull()
  })

  test('logged in but profile missing → error with sign-out, not the app', async () => {
    renderAt('/dashboard', { session, profile: null })
    expect(await screen.findByText("Couldn't load your account")).toBeTruthy()
    expect(screen.queryByText('dashboard page')).toBeNull()
  })

  test('[FE-7] after login the user returns to the original page including its query string', async () => {
    const router = createMemoryRouter(
      [
        { element: <GuestOnly />, children: [{ path: '/login', element: <p>login page</p> }] },
        { path: '/payments', element: <p>payments page</p> },
      ],
      { initialEntries: [{ pathname: '/login', state: { from: { pathname: '/payments', search: '?status=unpaid' } } }] },
    )
    render(
      <AuthContext.Provider value={{ session, isLoading: false } as unknown as AuthContextValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    )
    expect(await screen.findByText('payments page')).toBeTruthy()
    expect(router.state.location.search).toBe('?status=unpaid')
  })
})
