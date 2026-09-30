import type { Tables } from './database'

/*
  Value sets mirrored from the CHECK constraints in the migrations. The generated database types
  only know these columns as `string`; these unions are what the UI works with.
*/
export type Role = 'admin' | 'teacher' | 'student'
export type TeacherStatus = 'active' | 'on_leave' | 'inactive'
export type StudentStatus = 'active' | 'inactive'
export type PaymentStatus = 'paid' | 'unpaid'
export type ThemePreference = 'light' | 'dark' | 'system'

export type TeacherRow = Tables<'teachers'>
export type StudentRow = Tables<'students'>
export type ScheduleRow = Tables<'schedules'>
export type PaymentRow = Tables<'payments'>
export type ProfileRow = Tables<'profiles'>

/** A value/label pair for selects and filters. */
export interface Option<V extends string = string> {
  value: V
  label: string
}
