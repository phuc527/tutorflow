import { useState } from 'react'
import {
  CheckCircle2,
  CircleDashed,
  FilePlus2,
  History,
  Loader2,
  Pencil,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect, ListToolbar, RowActions } from '@/components/common/ListControls'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/features/auth/authContext'
import { useStudentOptions } from '@/features/students/hooks'
import { useTeacherOptions } from '@/features/teachers/hooks'
import { useListParams } from '@/hooks/useListParams'
import { usePermission } from '@/hooks/usePermission'
import { STALE_WRITE } from '@/services/errors'
import type { Payment } from '@/services/paymentsService'
import type { Option, PaymentStatus } from '@/types/domain'
import { currentBillingMonth, formatBillingMonth, formatDate } from '@/utils/datetime'
import { formatCurrency } from '@/utils/format'
import { isDayKey } from '@/utils/calendar'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { PaymentDetailsModal, PaymentHistoryDialog } from '../components/PaymentDialogs'
import { useGeneratePayments, usePaymentTotals, usePaymentsList, useSetPaymentStatus } from '../hooks'

type DialogState = { mode: 'toggle' | 'edit' | 'history'; payment: Payment } | null

const STATUS_OPTIONS: Option<PaymentStatus>[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
]

function TotalCard({
  icon: Icon,
  label,
  count,
  amount,
  isLoading,
  isError,
  tone,
}: {
  icon: LucideIcon
  label: string
  count?: number
  amount?: number
  isLoading: boolean
  isError: boolean
  tone: string
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`rounded-md p-2 ${tone}`}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {isLoading ? (
          <Skeleton className="mt-1 h-6 w-28" />
        ) : isError ? (
          <p className="text-sm text-danger">Couldn’t load totals</p>
        ) : (
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(amount)} <span className="text-sm font-normal text-muted-foreground">· {count} record{count === 1 ? '' : 's'}</span>
          </p>
        )}
      </div>
    </Card>
  )
}

export default function PaymentsPage() {
  const { profile, teacherId } = useAuth()
  const canMark = usePermission(PERMISSIONS.MARK_PAYMENTS) && Boolean(teacherId) && profile?.teacher?.status !== 'inactive'
  const isAdminView = usePermission(PERMISSIONS.VIEW_TEACHERS)

  const { params, setParam, setPage } = useListParams({ month: '', status: '', teacherId: '', studentId: '' })
  const month = isDayKey(params.month) ? params.month.slice(0, 8) + '01' : currentBillingMonth()
  const filters = { month, status: params.status, teacherId: params.teacherId, studentId: params.studentId }

  const listQuery = usePaymentsList({ ...filters, page: params.page, pageSize: DEFAULT_PAGE_SIZE })
  const totalsQuery = usePaymentTotals(filters)
  const teacherOptions = useTeacherOptions({ enabled: isAdminView })
  const studentOptions = useStudentOptions()
  const generate = useGeneratePayments()

  const [dialog, setDialog] = useState<DialogState>(null)
  const close = () => setDialog(null)
  const setStatus = useSetPaymentStatus({ onSuccess: close })

  const monthLabel = formatBillingMonth(month)
  const toggleTarget = dialog?.mode === 'toggle' ? dialog.payment : null
  const nextStatus: PaymentStatus = toggleTarget?.status === 'paid' ? 'unpaid' : 'paid'

  const columns: Column<Payment>[] = (
    [
    {
      key: 'student',
      header: 'Student',
      cell: (p: Payment) => (
        <div className="min-w-36">
          <div className="font-medium">{p.student?.full_name ?? 'Student no longer assigned'}</div>
          {p.notes && <div className="max-w-56 truncate text-xs text-muted-foreground" title={p.notes}>{p.notes}</div>}
        </div>
      ),
    },
    { key: 'teacher', header: 'Teacher', hidden: !isAdminView, cell: (p: Payment) => p.teacher?.full_name ?? '—' },
    { key: 'billing_month', header: 'Month', className: 'tabular-nums', cell: (p: Payment) => formatBillingMonth(p.billing_month) },
    { key: 'amount', header: 'Amount', className: 'text-right tabular-nums whitespace-nowrap', cell: (p: Payment) => formatCurrency(p.amount) },
    { key: 'status', header: 'Status', cell: (p: Payment) => <StatusBadge status={p.status} /> },
    { key: 'paid_at', header: 'Paid date', className: 'whitespace-nowrap tabular-nums', cell: (p: Payment) => formatDate(p.paid_at) },
    { key: 'marker', header: 'Marked by', cell: (p: Payment) => p.marker?.full_name ?? '—' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12 text-right whitespace-nowrap',
      cell: (p: Payment) => (
        <div className="flex items-center justify-end gap-1">
          {canMark && (
            <Button
              size="sm"
              variant={p.status === 'paid' ? 'outline' : 'default'}
              onClick={() => setDialog({ mode: 'toggle', payment: p })}
            >
              {p.status === 'paid' ? <Undo2 /> : <CheckCircle2 />}
              {p.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
            </Button>
          )}
          <RowActions
            label={`More actions for ${p.student?.full_name ?? 'payment'}`}
            actions={[
              { label: 'Edit amount / notes', icon: Pencil, hidden: !canMark, onSelect: () => setDialog({ mode: 'edit', payment: p }) },
              { label: 'View history', icon: History, onSelect: () => setDialog({ mode: 'history', payment: p }) },
            ]}
          />
        </div>
      ),
    },
    ] as (Column<Payment> & { hidden?: boolean })[]
  ).filter((c) => !c.hidden)

  const hasFilters = Boolean(params.status || params.teacherId || params.studentId)
  const totals = totalsQuery.data

  return (
    <>
      <PageHeader
        title="Payments"
        description={isAdminView ? 'Monthly payment status across the centre (read-only).' : 'Track and mark monthly payments for your students.'}
        actions={
          canMark && (
            <Button onClick={() => generate.mutate(month)} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
              Create records for {monthLabel}
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TotalCard icon={CheckCircle2} label="Paid" tone="bg-success-soft text-success" isLoading={totalsQuery.isPending}
          isError={Boolean(totalsQuery.error)} {...totals?.paid} />
        <TotalCard icon={CircleDashed} label="Unpaid" tone="bg-warning-soft text-warning" isLoading={totalsQuery.isPending}
          isError={Boolean(totalsQuery.error)} {...totals?.unpaid} />
        <TotalCard
          icon={Wallet}
          label="Total billed"
          tone="bg-primary-soft text-primary"
          isLoading={totalsQuery.isPending}
          isError={Boolean(totalsQuery.error)}
          count={(totals?.paid.count ?? 0) + (totals?.unpaid.count ?? 0)}
          amount={(totals?.paid.amount ?? 0) + (totals?.unpaid.amount ?? 0)}
        />
      </div>

      <Card>
        <ListToolbar>
          <MonthSwitcher month={month} onChange={(m) => setParam('month', m === currentBillingMonth() ? '' : m)} />
          <FilterSelect value={params.status} onChange={(v) => setParam('status', v)} options={STATUS_OPTIONS} allLabel="All statuses" className="sm:w-36" />
          {isAdminView && (
            <FilterSelect
              value={params.teacherId}
              onChange={(v) => setParam('teacherId', v)}
              options={(teacherOptions.data ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
              allLabel="All teachers"
            />
          )}
          <FilterSelect
            value={params.studentId}
            onChange={(v) => setParam('studentId', v)}
            options={(studentOptions.data ?? []).map((s) => ({ value: s.id, label: s.full_name }))}
            allLabel="All students"
          />
        </ListToolbar>
        <DataTable
          columns={columns}
          data={listQuery.data?.data}
          isLoading={listQuery.isPending}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          emptyTitle={hasFilters ? 'No payments match your filters' : `No payment records for ${monthLabel}`}
          emptyDescription={
            hasFilters
              ? 'Try a different filter.'
              : canMark
                ? 'Create this month’s records for all your assigned students in one click.'
                : 'Teachers create payment records for their students each month.'
          }
          emptyAction={
            !hasFilters &&
            canMark && (
              <Button onClick={() => generate.mutate(month)} disabled={generate.isPending}>
                <FilePlus2 /> Create records for {monthLabel}
              </Button>
            )
          }
          pagination={{ page: params.page, pageSize: DEFAULT_PAGE_SIZE, total: listQuery.data?.count ?? 0, onPageChange: setPage }}
        />
      </Card>

      {canMark && (
        <>
          <ConfirmDialog
            open={Boolean(toggleTarget)}
            onOpenChange={(open) => !open && close()}
            title={nextStatus === 'paid' ? 'Mark as paid?' : 'Mark as unpaid?'}
            description={
              toggleTarget
                ? nextStatus === 'paid'
                  ? `Confirm that ${toggleTarget.student?.full_name ?? 'this student'} has paid ${formatCurrency(toggleTarget.amount)} for ${formatBillingMonth(toggleTarget.billing_month)}. Today's date and your name will be recorded.`
                  : `This clears the paid date for ${toggleTarget.student?.full_name ?? 'this student'}. The change is kept in the payment history.`
                : ''
            }
            confirmLabel={nextStatus === 'paid' ? 'Mark paid' : 'Mark unpaid'}
            variant={nextStatus === 'paid' ? 'default' : 'destructive'}
            isPending={setStatus.isPending}
            onConfirm={() =>
              toggleTarget &&
              setStatus.mutate({ payment: toggleTarget, status: nextStatus }, { onError: (e) => e.code === STALE_WRITE && close() })
            }
          />
          <PaymentDetailsModal payment={dialog?.mode === 'edit' ? dialog.payment : null} onOpenChange={(open) => !open && close()} />
        </>
      )}
      <PaymentHistoryDialog payment={dialog?.mode === 'history' ? dialog.payment : null} onOpenChange={(open) => !open && close()} />
    </>
  )
}
