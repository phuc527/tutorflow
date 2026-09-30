import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120, 'Name is too long'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
