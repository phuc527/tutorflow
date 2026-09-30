import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { ROLES } from '@/constants/roles'
import { GuestOnly, RequireAuth, RequireRole } from '@/features/auth/components/RouteGuards'
import LoginPage from '@/features/auth/pages/LoginPage'
import UnauthorizedPage from '@/features/auth/pages/UnauthorizedPage'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import TeachersPage from '@/features/teachers/pages/TeachersPage'
import StudentsPage from '@/features/students/pages/StudentsPage'
import SchedulesPage from '@/features/schedules/pages/SchedulesPage'
import PaymentsPage from '@/features/payments/pages/PaymentsPage'
import NotFoundPage from './NotFoundPage'
import RouteErrorPage from './RouteErrorPage'

/*
  Route tree. Guards are "layout routes": they render <Outlet/> when allowed, or redirect.
    GuestOnly   → /login is only for logged-out users
    RequireAuth → everything inside needs a session and a profile
    RequireRole → narrows further by role
  `handle.crumb` feeds the breadcrumbs.
*/
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage />, handle: { crumb: 'Dashboard' } },
              { path: 'students', element: <StudentsPage />, handle: { crumb: 'Students' } },
              { path: 'schedules', element: <SchedulesPage />, handle: { crumb: 'Schedules' } },
              { path: 'payments', element: <PaymentsPage />, handle: { crumb: 'Payments' } },
              {
                element: <RequireRole roles={[ROLES.ADMIN]} />,
                children: [{ path: 'teachers', element: <TeachersPage />, handle: { crumb: 'Teachers' } }],
              },
            ],
          },
          { path: '/unauthorized', element: <UnauthorizedPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
