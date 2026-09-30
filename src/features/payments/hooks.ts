import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation, type MutationHookOptions } from '@/hooks/useAppMutation'
import type { PaymentDetailsValues } from '@/schemas/payment'
import { paymentsService, type Payment, type PaymentFilters, type PaymentListParams } from '@/services/paymentsService'
import type { PaymentStatus } from '@/types/domain'
import { formatBillingMonth } from '@/utils/datetime'

export function usePaymentsList(params: PaymentListParams) {
  return useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => paymentsService.list(params),
    placeholderData: keepPreviousData,
  })
}

export function usePaymentTotals({ month, teacherId, studentId }: PaymentFilters) {
  const params = { month, teacherId, studentId }
  return useQuery({
    queryKey: [...queryKeys.payments.all, 'totals', params],
    queryFn: () => paymentsService.monthTotals(params),
    placeholderData: keepPreviousData,
  })
}

export function usePaymentHistory(paymentId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.history(paymentId),
    queryFn: () => paymentsService.history(paymentId!),
    enabled: Boolean(paymentId),
  })
}

// Payment changes also affect the students list ("This month" column).
const INVALIDATE = [queryKeys.payments.all, queryKeys.students.all]

export function useSetPaymentStatus({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: ({ payment, status }: { payment: Payment; status: PaymentStatus }) => paymentsService.setStatus(payment, status),
    invalidate: INVALIDATE,
    successMessage: (row) => `${row.student?.full_name ?? 'Payment'} marked as ${row.status}`,
    onSuccess,
  })
}

export function useUpdatePaymentDetails({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: ({ payment, values }: { payment: Payment; values: PaymentDetailsValues }) =>
      paymentsService.updateDetails(payment, values),
    invalidate: INVALIDATE,
    successMessage: 'Payment updated',
    onSuccess,
  })
}

export function useGeneratePayments() {
  return useAppMutation({
    mutationFn: (month: string) => paymentsService.generateForMonth(month),
    invalidate: INVALIDATE,
    successMessage: (created, month) =>
      created
        ? `Created ${created} payment record${created > 1 ? 's' : ''} for ${formatBillingMonth(month)}`
        : 'All assigned students already have a record for this month',
  })
}
