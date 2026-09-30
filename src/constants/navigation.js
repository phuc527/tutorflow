import { CalendarDays, GraduationCap, LayoutDashboard, UserCog, Users, Wallet } from 'lucide-react'
import { ROLES } from './roles'

/**
 * Sidebar entries. `roles` lists who sees the entry; `labels` lets one route read differently per role
 * (a teacher's /students page only ever shows their own assigned students, enforced by RLS).
 * Hiding a link is UX only: route guards and database policies do the real enforcement.
 */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.TEACHER] },
  { to: '/teachers', label: 'Teachers', icon: GraduationCap, roles: [ROLES.ADMIN] },
  {
    to: '/students',
    label: 'Students',
    labels: { [ROLES.TEACHER]: 'My Students' },
    icon: Users,
    roles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  { to: '/schedules', label: 'Schedules', icon: CalendarDays, roles: [ROLES.ADMIN, ROLES.TEACHER] },
  { to: '/payments', label: 'Payments', icon: Wallet, roles: [ROLES.ADMIN, ROLES.TEACHER] },
  { to: '/users', label: 'Users', icon: UserCog, roles: [ROLES.ADMIN] },
  { to: '/my/classes', label: 'My classes', icon: CalendarDays, roles: [ROLES.STUDENT] },
  { to: '/my/fees', label: 'My fees', icon: Wallet, roles: [ROLES.STUDENT] },
]

/** Items visible to a role. A null role (not yet known) sees nothing. */
export function navItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    label: item.labels?.[role] ?? item.label,
  }))
}

/** Where "/" (and a fresh sign-in) takes each role. */
export function homePathForRole(role) {
  return role === ROLES.STUDENT ? '/my/classes' : '/dashboard'
}
