import { hasPermission, type Permission } from '@/constants/permissions'
import { useAuth } from '@/features/auth/authContext'

/** `const canManage = usePermission(PERMISSIONS.MANAGE_SCHEDULES)` → show or hide controls. */
export function usePermission(permission: Permission) {
  const { role } = useAuth()
  return hasPermission(role, permission)
}
