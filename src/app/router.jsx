import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { FullPageSpinner } from '@/components/common/States'
import { ROLES } from '@/constants/roles'
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from '@/features/auth/components/RouteGuards'
import NotFoundPage from './NotFoundPage'
import RouteErrorPage from './RouteErrorPage'

/*
  Route tree. Guards are "layout routes": they render <Outlet/> when allowed, or redirect.
    GuestOnly   → /login and /signup are only for logged-out users; "/" redirects by role
    RequireAuth → everything inside needs a session and a profile
    RequireRole → narrows further by role
  `handle.crumb` feeds the breadcrumbs.

  Pages are code-split with `lazy`: each page's JavaScript is downloaded the first time it's
  visited, so the initial bundle only contains the shell. The layout shows a progress bar meanwhile.
*/
const page = (importer) => async () => ({ Component: (await importer()).default })

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', lazy: page(() => import('@/features/auth/pages/LoginPage')) },
          { path: '/signup', lazy: page(() => import('@/features/auth/pages/SignupPage')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              { index: true, element: <HomeRedirect /> },
              {
                element: <RequireRole roles={[ROLES.ADMIN, ROLES.TEACHER]} />,
                children: [
                  { path: 'dashboard', lazy: page(() => import('@/features/dashboard/pages/DashboardPage')), handle: { crumb: 'Dashboard' } },
                  { path: 'students', lazy: page(() => import('@/features/students/pages/StudentsPage')), handle: { crumb: 'Students' } },
                  { path: 'schedules', lazy: page(() => import('@/features/schedules/pages/SchedulesPage')), handle: { crumb: 'Schedules' } },
                  { path: 'payments', lazy: page(() => import('@/features/payments/pages/PaymentsPage')), handle: { crumb: 'Payments' } },
                  {
                    element: <RequireRole roles={[ROLES.ADMIN]} />,
                    children: [
                      { path: 'teachers', lazy: page(() => import('@/features/teachers/pages/TeachersPage')), handle: { crumb: 'Teachers' } },
                      { path: 'users', lazy: page(() => import('@/features/users/pages/UsersPage')), handle: { crumb: 'Users' } },
                    ],
                  },
                ],
              },
              {
                element: <RequireRole roles={[ROLES.STUDENT]} />,
                children: [
                  { path: 'my/classes', lazy: page(() => import('@/features/portal/pages/MyClassesPage')), handle: { crumb: 'My classes' } },
                  { path: 'my/fees', lazy: page(() => import('@/features/portal/pages/MyFeesPage')), handle: { crumb: 'My fees' } },
                ],
              },
            ],
          },
          { path: '/unauthorized', lazy: page(() => import('@/features/auth/pages/UnauthorizedPage')) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
