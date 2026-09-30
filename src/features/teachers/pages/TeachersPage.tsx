import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect, ListToolbar, RowActions, SearchInput } from '@/components/common/ListControls'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { TEACHER_STATUSES } from '@/constants/options'
import { useListParams } from '@/hooks/useListParams'
import type { TeacherListItem } from '@/services/teachersService'
import { formatCurrency } from '@/utils/format'
import { TeacherFormModal } from '../components/TeacherFormModal'
import { useDeleteTeacher, useTeachersList } from '../hooks'

type DialogState = { mode: 'create' } | { mode: 'edit' | 'delete'; teacher: TeacherListItem } | null

export default function TeachersPage() {
  const { params, setParam, setPage } = useListParams({ q: '', status: '' })
  const listQuery = useTeachersList({ ...params, pageSize: DEFAULT_PAGE_SIZE })

  const [dialog, setDialog] = useState<DialogState>(null)
  const close = () => setDialog(null)
  const deleteTeacher = useDeleteTeacher({ onSuccess: close })

  const columns: Column<TeacherListItem>[] = [
    {
      key: 'full_name',
      header: 'Teacher',
      cell: (t: TeacherListItem) => (
        <div className="min-w-40">
          <div className="font-medium">{t.full_name}</div>
          <div className="text-xs text-muted-foreground">{t.email}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', className: 'whitespace-nowrap' },
    { key: 'specialization', header: 'Specialization' },
    {
      key: 'hourly_rate',
      header: 'Hourly rate',
      className: 'text-right tabular-nums whitespace-nowrap',
      cell: (t: TeacherListItem) => formatCurrency(t.hourly_rate),
    },
    { key: 'student_count', header: 'Students', className: 'text-center tabular-nums' },
    {
      key: 'profile_id',
      header: 'Login',
      cell: (t: TeacherListItem) =>
        t.profile_id ? <Badge tone="primary">Linked</Badge> : <Badge title="No auth user with this email yet">None</Badge>,
    },
    { key: 'status', header: 'Status', cell: (t: TeacherListItem) => <StatusBadge status={t.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12 text-right',
      cell: (t: TeacherListItem) => (
        <RowActions
          label={`Actions for ${t.full_name}`}
          actions={[
            { label: 'Edit', icon: Pencil, onSelect: () => setDialog({ mode: 'edit', teacher: t }) },
            { label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setDialog({ mode: 'delete', teacher: t }) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Teachers"
        description="Manage teacher records and their account status."
        actions={
          <Button onClick={() => setDialog({ mode: 'create' })}>
            <Plus /> Add teacher
          </Button>
        }
      />

      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onSearch={(v) => setParam('q', v)} placeholder="Search name, email, subject…" />
          <FilterSelect
            value={params.status}
            onChange={(v) => setParam('status', v)}
            options={TEACHER_STATUSES}
            allLabel="All statuses"
          />
        </ListToolbar>
        <DataTable
          columns={columns}
          data={listQuery.data?.data}
          isLoading={listQuery.isPending}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          emptyTitle={params.q || params.status ? 'No teachers match your filters' : 'No teachers yet'}
          emptyDescription={params.q || params.status ? 'Try a different search or filter.' : 'Add your first teacher to get started.'}
          pagination={{
            page: params.page,
            pageSize: DEFAULT_PAGE_SIZE,
            total: listQuery.data?.count ?? 0,
            onPageChange: setPage,
          }}
        />
      </Card>

      <TeacherFormModal
        open={dialog?.mode === 'create' || dialog?.mode === 'edit'}
        onOpenChange={(open: boolean) => !open && close()}
        teacher={dialog?.mode === 'edit' ? dialog.teacher : null}
      />

      <ConfirmDialog
        open={dialog?.mode === 'delete'}
        onOpenChange={(open: boolean) => !open && close()}
        title="Delete teacher?"
        description={
          dialog?.mode === 'delete'
            ? `${dialog.teacher.full_name} and their student assignments will be removed. Teachers who have classes or payment records can't be deleted; set them to Inactive instead.`
            : ''
        }
        confirmLabel="Delete"
        isPending={deleteTeacher.isPending}
        onConfirm={() => dialog?.mode === 'delete' && deleteTeacher.mutate(dialog.teacher.id)}
      />
    </>
  )
}
