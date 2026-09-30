import { useState } from 'react'
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { FilterSelect, ListToolbar, RowActions, SearchInput } from '@/components/common/ListControls'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DEFAULT_PAGE_SIZE } from '@/constants/app'
import { GRADES, STUDENT_STATUSES } from '@/constants/options'
import { PERMISSIONS } from '@/constants/permissions'
import { useTeacherOptions } from '@/features/teachers/hooks'
import { useListParams } from '@/hooks/useListParams'
import { usePermission } from '@/hooks/usePermission'
import type { StudentListItem } from '@/services/studentsService'
import { AssignTeachersDialog } from '../components/AssignTeachersDialog'
import { StudentFormModal } from '../components/StudentFormModal'
import { useDeleteStudent, useStudentsList } from '../hooks'

type DialogState = { mode: 'create' } | { mode: 'edit' | 'assign' | 'delete'; student: StudentListItem } | null

export default function StudentsPage() {
  const canManage = usePermission(PERMISSIONS.MANAGE_STUDENTS)
  const canAssign = usePermission(PERMISSIONS.ASSIGN_STUDENTS)
  const canFilterByTeacher = usePermission(PERMISSIONS.VIEW_TEACHERS)

  const { params, setParam, setPage } = useListParams({ q: '', status: '', grade: '', teacherId: '' })
  const listQuery = useStudentsList({ ...params, pageSize: DEFAULT_PAGE_SIZE })
  const teacherOptions = useTeacherOptions({ enabled: canFilterByTeacher })

  const [dialog, setDialog] = useState<DialogState>(null)
  const close = () => setDialog(null)
  const deleteStudent = useDeleteStudent({ onSuccess: close })

  const hasFilters = Boolean(params.q || params.status || params.grade || params.teacherId)

  const columns = (
    [
    {
      key: 'full_name',
      header: 'Student',
      cell: (s: StudentListItem) => (
        <div className="min-w-40">
          <div className="font-medium">{s.full_name}</div>
          {s.parent_name && <div className="text-xs text-muted-foreground">Parent: {s.parent_name}</div>}
        </div>
      ),
    },
    { key: 'grade', header: 'Grade', className: 'text-center', cell: (s: StudentListItem) => s.grade ?? '—' },
    { key: 'parent_phone', header: 'Parent phone', className: 'whitespace-nowrap', cell: (s: StudentListItem) => s.parent_phone ?? s.phone ?? '—' },
    {
      key: 'teachers',
      header: 'Teachers',
      hidden: !canFilterByTeacher, // a teacher only ever sees themselves here
      cell: (s: StudentListItem) =>
        s.teachers.length ? (
          <div className="flex max-w-56 flex-wrap gap-1">
            {s.teachers.map((t) => (
              <Badge key={t.id}>{t.full_name}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-warning">Unassigned</span>
        ),
    },
    {
      key: 'payment',
      header: 'This month',
      cell: (s: StudentListItem) => (s.paymentStatus ? <StatusBadge status={s.paymentStatus} /> : <span className="text-xs text-muted-foreground">No record</span>),
    },
    { key: 'status', header: 'Status', cell: (s: StudentListItem) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12 text-right',
      hidden: !canManage && !canAssign,
      cell: (s: StudentListItem) => (
        <RowActions
          label={`Actions for ${s.full_name}`}
          actions={[
            { label: 'Edit', icon: Pencil, hidden: !canManage, onSelect: () => setDialog({ mode: 'edit', student: s }) },
            { label: 'Assign teachers', icon: UserPlus, hidden: !canAssign, onSelect: () => setDialog({ mode: 'assign', student: s }) },
            {
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              hidden: !canManage,
              onSelect: () => setDialog({ mode: 'delete', student: s }),
            },
          ]}
        />
      ),
    },
    ] as (Column<StudentListItem> & { hidden?: boolean })[]
  ).filter((column) => !column.hidden)

  return (
    <>
      <PageHeader
        title={canManage ? 'Students' : 'My Students'}
        description={canManage ? 'Manage students and assign them to teachers.' : 'Students assigned to you.'}
        actions={
          canManage && (
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus /> Add student
            </Button>
          )
        }
      />

      <Card>
        <ListToolbar>
          <SearchInput value={params.q} onSearch={(v) => setParam('q', v)} placeholder="Search student, parent, phone…" />
          {canFilterByTeacher && (
            <FilterSelect
              value={params.teacherId}
              onChange={(v) => setParam('teacherId', v)}
              options={(teacherOptions.data ?? []).map((t) => ({ value: t.id, label: t.full_name }))}
              allLabel="All teachers"
            />
          )}
          <FilterSelect value={params.grade} onChange={(v) => setParam('grade', v)} options={GRADES} allLabel="All grades" className="sm:w-36" />
          <FilterSelect
            value={params.status}
            onChange={(v) => setParam('status', v)}
            options={STUDENT_STATUSES}
            allLabel="All statuses"
            className="sm:w-36"
          />
        </ListToolbar>
        <DataTable
          columns={columns}
          data={listQuery.data?.data}
          isLoading={listQuery.isPending}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          emptyTitle={hasFilters ? 'No students match your filters' : canManage ? 'No students yet' : 'No students assigned to you yet'}
          emptyDescription={
            hasFilters
              ? 'Try a different search or filter.'
              : canManage
                ? 'Add a student, then assign them to a teacher.'
                : 'Your administrator assigns students to teachers.'
          }
          pagination={{
            page: params.page,
            pageSize: DEFAULT_PAGE_SIZE,
            total: listQuery.data?.count ?? 0,
            onPageChange: setPage,
          }}
        />
      </Card>

      {canManage && (
        <>
          <StudentFormModal
            open={dialog?.mode === 'create' || dialog?.mode === 'edit'}
            onOpenChange={(open: boolean) => !open && close()}
            student={dialog?.mode === 'edit' ? dialog.student : null}
          />
          <ConfirmDialog
            open={dialog?.mode === 'delete'}
            onOpenChange={(open: boolean) => !open && close()}
            title="Delete student?"
            description={
              dialog?.mode === 'delete'
                ? `${dialog.student.full_name} and their teacher assignments will be removed. Students who have classes or payment records can't be deleted; set them to Inactive instead.`
                : ''
            }
            confirmLabel="Delete"
            isPending={deleteStudent.isPending}
            onConfirm={() => dialog?.mode === 'delete' && deleteStudent.mutate(dialog.student.id)}
          />
        </>
      )}
      {canAssign && (
        <AssignTeachersDialog
          student={dialog?.mode === 'assign' ? dialog.student : null}
          onOpenChange={(open: boolean) => !open && close()}
        />
      )}
    </>
  )
}
