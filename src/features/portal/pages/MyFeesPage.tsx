import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatBillingMonth, formatDate } from '@/utils/datetime'
import { formatCurrency } from '@/utils/format'
import type { PortalPayment } from '@/services/portalService'
import { NotLinkedState } from '../components/NotLinkedState'
import { useMyPayments, useMyStudents } from '../hooks'

export default function MyFeesPage() {
  const students = useMyStudents()
  const linked = Boolean(students.data?.length)
  const payments = useMyPayments({ enabled: linked })
  const showStudent = (students.data?.length ?? 0) > 1

  const columns: Column<PortalPayment>[] = [
    { key: 'billing_month', header: 'Month', cell: (p) => formatBillingMonth(p.billing_month) },
    ...(showStudent ? [{ key: 'student_name', header: 'Student' }] : []),
    { key: 'teacher_name', header: 'Teacher' },
    { key: 'amount', header: 'Amount', className: 'text-right tabular-nums', cell: (p) => formatCurrency(p.amount) },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'paid_at', header: 'Paid on', cell: (p) => formatDate(p.paid_at) },
  ]

  let body
  if (students.isLoading) body = <LoadingState />
  else if (students.error) body = <ErrorState error={students.error} onRetry={students.refetch} />
  else if (!linked) body = <NotLinkedState />
  else
    body = (
      <DataTable
        columns={columns}
        data={payments.data}
        isLoading={payments.isLoading}
        error={payments.error}
        onRetry={payments.refetch}
        emptyTitle="No fees yet"
      />
    )

  return (
    <>
      <PageHeader title="My fees" description="Monthly tuition recorded by your teachers." />
      {body}
    </>
  )
}
