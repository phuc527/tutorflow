import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { FormField } from '@/components/common/FormField'
import { FormModal } from '@/components/common/FormModal'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { paymentDetailsSchema } from '@/schemas/payment'
import { STALE_WRITE } from '@/services/errors'
import type { Payment } from '@/services/paymentsService'
import { formatCurrency } from '@/utils/format'
import { formatDateTime } from '@/utils/datetime'
import { usePaymentHistory, useUpdatePaymentDetails } from '../hooks'

const FORM_ID = 'payment-details-form'

/** Teacher: adjust the amount or add a note. Status changes go through the confirm toggle instead. */
interface PaymentDialogProps {
  payment: Payment | null
  onOpenChange: (open: boolean) => void
}

export function PaymentDetailsModal({ payment, onOpenChange }: PaymentDialogProps) {
  const save = useUpdatePaymentDetails({ onSuccess: () => onOpenChange(false) })
  const isPaid = payment?.status === 'paid'
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(paymentDetailsSchema), defaultValues: { amount: 0, notes: '' } })

  useEffect(() => {
    if (payment) reset({ amount: Number(payment.amount), notes: payment.notes ?? '' })
  }, [payment, reset])

  return (
    <FormModal
      open={Boolean(payment)}
      onOpenChange={onOpenChange}
      title="Edit payment"
      description={payment ? `${payment.student?.full_name ?? 'Student'}` : undefined}
      formId={FORM_ID}
      isSubmitting={save.isPending}
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit((values) => {
          if (!payment) return
          save.mutate({ payment, values }, { onError: (e) => e.code === STALE_WRITE && onOpenChange(false) })
        })}
      >
        <FormField
          label="Amount (VND)"
          htmlFor="amount"
          error={errors.amount}
          required
          hint={isPaid ? 'Locked while the record is paid. Mark it unpaid to change the amount.' : undefined}
        >
          <Input
            id="amount"
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            readOnly={isPaid}
            aria-invalid={Boolean(errors.amount)}
            {...register('amount')}
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes} hint="e.g. paid in cash to the front desk">
          <Textarea id="notes" rows={3} {...register('notes')} />
        </FormField>
      </form>
    </FormModal>
  )
}

/** Audit trail written by the database trigger: who changed the status, when, from what to what. */
export function PaymentHistoryDialog({ payment, onOpenChange }: PaymentDialogProps) {
  const historyQuery = usePaymentHistory(payment?.id)

  return (
    <Dialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
          <DialogDescription>{payment?.student?.full_name ?? ''}</DialogDescription>
        </DialogHeader>
        {historyQuery.isPending ? (
          <LoadingState rows={3} className="p-0" />
        ) : historyQuery.error ? (
          <ErrorState error={historyQuery.error} onRetry={historyQuery.refetch} />
        ) : historyQuery.data.length === 0 ? (
          <EmptyState title="No changes recorded" />
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {historyQuery.data.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  {entry.old_status ? (
                    <>
                      <StatusBadge status={entry.old_status} />
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="changed to" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Created as</span>
                  )}
                  <StatusBadge status={entry.new_status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(entry.changed_at)} · by {entry.changer?.full_name ?? 'unknown'}
                  {entry.amount !== null && ` · ${formatCurrency(entry.amount)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
