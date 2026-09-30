import type { Role } from '@/types/domain'
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
  MANAGE_USERS: 'users:manage',
  VIEW_OWN_RECORDS: 'own:view',
} as const)

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_TEACHERS,
    PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.ASSIGN_STUDENTS,
    PERMISSIONS.MANAGE_SCHEDULES,
    PERMISSIONS.MANAGE_USERS,
  ],
  [ROLES.TEACHER]: [PERMISSIONS.MANAGE_SCHEDULES, PERMISSIONS.MARK_PAYMENTS],
  [ROLES.STUDENT]: [PERMISSIONS.VIEW_OWN_RECORDS],
}

export function hasPermission(role: string | null | undefined, permission: Permission) {
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false
  return ROLE_PERMISSIONS[role as Role].includes(permission)
}
