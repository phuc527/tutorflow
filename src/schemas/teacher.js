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
  hourly_rate: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Use whole đồng')
    .min(0, 'Cannot be negative')
    .max(100_000_000, 'That rate looks too high'),
  status: z.enum(['active', 'on_leave', 'inactive']),
})

export const teacherDefaults = {
  full_name: '',
  email: '',
  phone: '',
  specialization: '',
  hourly_rate: 0,
  status: 'active',
}
