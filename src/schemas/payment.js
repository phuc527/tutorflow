import { z } from 'zod'

export const paymentDetailsSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .int('Use whole đồng')
    .min(0, 'Cannot be negative')
    .max(1_000_000_000, 'That amount looks too high'),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
})
