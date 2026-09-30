import { z } from 'zod'
import { optionalPhone } from './teacher'

export const studentSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address'),
  phone: optionalPhone,
  parent_name: z.string().trim().max(120),
  parent_phone: optionalPhone,
  // <select> gives a string; '' means "not set" → null
  grade: z
    .string()
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(z.number().int().min(1).max(12).nullable()),
  status: z.enum(['active', 'inactive']),
  notes: z.string().trim().max(2000, 'Keep notes under 2000 characters'),
})

export const studentDefaults = {
  full_name: '',
  email: '',
  phone: '',
  parent_name: '',
  parent_phone: '',
  grade: '',
  status: 'active',
  notes: '',
}

/** Database row → form values (null → '' so inputs stay controlled). */
export function studentToForm(student) {
  return Object.fromEntries(
    Object.keys(studentDefaults).map((key) => [key, student[key] === null || student[key] === undefined ? '' : String(student[key])]),
  )
}
