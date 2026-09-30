import { ROLES } from './roles'

/**
 * Every UI permission check goes through this table instead of scattering `role === 'admin'`
 * across components. It mirrors the RLS access matrix in supabase/migrations/…_rls_policies.sql.
 * These checks only decide what the UI shows; the database enforces the same rules independently.
 */
export const PERMISSIONS = Object.freeze({
  VIEW_TEACHERS: 'teachers:view',
  MANAGE_TEACHERS: 'teachers:manage',
  MANAGE_STUDENTS: 'students:manage',
  ASSIGN_STUDENTS: 'students:assign',
  MANAGE_SCHEDULES: 'schedules:manage',
  MARK_PAYMENTS: 'payments:mark',
})

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_TEACHERS,
    PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.ASSIGN_STUDENTS,
  ],
  [ROLES.TEACHER]: [PERMISSIONS.MANAGE_SCHEDULES, PERMISSIONS.MARK_PAYMENTS],
}

export function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
