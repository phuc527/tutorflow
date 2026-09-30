import { describe, expect, test } from 'vitest'
import { navItemsForRole } from './navigation'
import { hasPermission, PERMISSIONS } from './permissions'

// These mirror the RLS access matrix. If a UI rule drifts from the database rule, these fail.
describe('UI permissions mirror the database rules', () => {
  test('admin manages people but never schedules or payments', () => {
    expect(hasPermission('admin', PERMISSIONS.MANAGE_TEACHERS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.MANAGE_STUDENTS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.ASSIGN_STUDENTS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.MANAGE_SCHEDULES)).toBe(false)
    expect(hasPermission('admin', PERMISSIONS.MARK_PAYMENTS)).toBe(false)
  })

  test('teacher manages schedules and payments but not people', () => {
    expect(hasPermission('teacher', PERMISSIONS.MANAGE_SCHEDULES)).toBe(true)
    expect(hasPermission('teacher', PERMISSIONS.MARK_PAYMENTS)).toBe(true)
    expect(hasPermission('teacher', PERMISSIONS.MANAGE_TEACHERS)).toBe(false)
    expect(hasPermission('teacher', PERMISSIONS.MANAGE_STUDENTS)).toBe(false)
    expect(hasPermission('teacher', PERMISSIONS.VIEW_TEACHERS)).toBe(false)
  })

  test('unknown or missing roles get nothing', () => {
    expect(hasPermission(null, PERMISSIONS.MANAGE_SCHEDULES)).toBe(false)
    expect(hasPermission('superuser', PERMISSIONS.MANAGE_TEACHERS)).toBe(false)
    expect(navItemsForRole(null)).toEqual([])
  })

  test('navigation per role', () => {
    expect(navItemsForRole('admin').map((i) => i.label)).toEqual(['Dashboard', 'Teachers', 'Students', 'Schedules', 'Payments'])
    expect(navItemsForRole('teacher').map((i) => i.label)).toEqual(['Dashboard', 'My Students', 'Schedules', 'Payments'])
  })
})
