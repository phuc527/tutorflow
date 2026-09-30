import type { Role } from '@/types/domain'

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
} as const satisfies Record<string, Role>)

/** Narrow a profile's role column (a plain string in the database types) to a Role. */
export function asRole(value: string | null | undefined): Role | null {
  return value === 'admin' || value === 'teacher' || value === 'student' ? value : null
}
