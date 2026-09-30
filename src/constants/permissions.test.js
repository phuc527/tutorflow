import { describe, expect, test } from 'vitest'
import { homePathForRole, navItemsForRole } from './navigation'
import { hasPermission, PERMISSIONS } from './permissions'

// These mirror the RLS access matrix. If a UI rule drifts from the database rule, these fail.
describe('UI permissions mirror the database rules', () => {
  test('admin manages people and schedules but never payments', () => {
    expect(hasPermission('admin', PERMISSIONS.MANAGE_TEACHERS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.MANAGE_STUDENTS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.ASSIGN_STUDENTS)).toBe(true)
    expect(hasPermission('admin', PERMISSIONS.MANAGE_SCHEDULES)).toBe(true)
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
    expect(navItemsForRole('admin').map((i) => i.label)).toEqual(['Dashboard', 'Teachers', 'Students', 'Schedules', 'Payments', 'Users'])
    expect(navItemsForRole('teacher').map((i) => i.label)).toEqual(['Dashboard', 'My Students', 'Schedules', 'Payments'])
    expect(navItemsForRole('student').map((i) => i.label)).toEqual(['My classes', 'My fees'])
  })

  test('student only views their own records', () => {
    expect(hasPermission('student', PERMISSIONS.VIEW_OWN_RECORDS)).toBe(true)
    for (const p of [PERMISSIONS.MANAGE_SCHEDULES, PERMISSIONS.MARK_PAYMENTS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.MANAGE_USERS, PERMISSIONS.VIEW_TEACHERS]) {
      expect(hasPermission('student', p)).toBe(false)
    }
    expect(hasPermission('admin', PERMISSIONS.MANAGE_USERS)).toBe(true)
    expect(hasPermission('teacher', PERMISSIONS.MANAGE_USERS)).toBe(false)
  })

  test('home page per role', () => {
    expect(homePathForRole('student')).toBe('/my/classes')
    expect(homePathForRole('admin')).toBe('/dashboard')
    expect(homePathForRole('teacher')).toBe('/dashboard')
  })
})
