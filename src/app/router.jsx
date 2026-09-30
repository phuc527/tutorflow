import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { NAV_ITEMS } from '@/constants/navigation'
import DashboardPage from '@/features/dashboard/pages/DashboardPage'
import TeachersPage from '@/features/teachers/pages/TeachersPage'
import StudentsPage from '@/features/students/pages/StudentsPage'
import SchedulesPage from '@/features/schedules/pages/SchedulesPage'
import PaymentsPage from '@/features/payments/pages/PaymentsPage'
import UnauthorizedPage from '@/features/auth/pages/UnauthorizedPage'
import NotFoundPage from './NotFoundPage'
import RouteErrorPage from './RouteErrorPage'

/*
  Route tree. `handle.crumb` feeds the breadcrumbs.
  PHASE 1: no auth yet, so the layout shows every nav item.
  Phase 2 wraps these routes in auth + role guards and derives the nav from the user's profile.
*/
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout profile={null} navItems={NAV_ITEMS} />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage />, handle: { crumb: 'Dashboard' } },
      { path: 'teachers', element: <TeachersPage />, handle: { crumb: 'Teachers' } },
      { path: 'students', element: <StudentsPage />, handle: { crumb: 'Students' } },
      { path: 'schedules', element: <SchedulesPage />, handle: { crumb: 'Schedules' } },
      { path: 'payments', element: <PaymentsPage />, handle: { crumb: 'Payments' } },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
])
