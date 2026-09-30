import { z } from 'zod'
import { PHONE_PATTERN } from '@/constants/options'

// Mirrors the CHECK constraints on public.teachers, so most mistakes are caught before a request is sent.
// The database still re-validates everything.
export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Use 8–20 digits (spaces, +, -, ( ) allowed)')

export const teacherSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: optionalPhone,
  specialization: z.string().trim().max(120),
  // Blank is an error rather than silently becoming 0.
  hourly_rate: z
    .union([z.string(), z.number()])
    .refine((v) => String(v).trim() !== '', 'Hourly rate is required (use 0 if not applicable)')
    .pipe(
      z.coerce
        .number({ invalid_type_error: 'Enter a number' })
        .int('Use whole đồng')
        .min(0, 'Cannot be negative')
        .max(100_000_000, 'That rate looks too high'),
    ),
  status: z.enum(['active', 'on_leave', 'inactive']),
})

export type TeacherFormInput = z.input<typeof teacherSchema>
export type TeacherValues = z.output<typeof teacherSchema>

export const teacherDefaults: TeacherFormInput = {
  full_name: '',
  email: '',
  phone: '',
  specialization: '',
  hourly_rate: 0,
  status: 'active',
}
