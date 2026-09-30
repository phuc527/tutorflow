// Value sets mirrored from the CHECK constraints in the schema migration.

export const TEACHER_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'inactive', label: 'Inactive' },
]

export const STUDENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export const GRADES = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` }))

export const PHONE_PATTERN = /^[0-9+() .-]{8,20}$/
