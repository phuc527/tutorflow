import { X } from 'lucide-react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { NativeSelect } from '@/components/ui/input'
import { ROLES } from '@/constants/roles'
import type { StudentOption } from '@/services/studentsService'
import type { UserAccount } from '@/services/usersService'
import type { Role } from '@/types/domain'
import { useLinkStudent, useSetUserRole, useStudentOptions, useUnlinkStudent, useUsers } from '../hooks'

function LinkedTo({ user, studentOptions }: { user: UserAccount; studentOptions: StudentOption[] | undefined }) {
  const unlink = useUnlinkStudent()
  const link = useLinkStudent()

  if (user.role === ROLES.TEACHER) return user.teacher?.full_name ?? <span className="text-muted-foreground">No teacher record</span>
  if (user.role !== ROLES.STUDENT) return <span className="text-muted-foreground">—</span>

  const linkedIds = new Set(user.studentLinks.map((l) => l.student.id))
  const addable = (studentOptions ?? []).filter((s) => !linkedIds.has(s.id))
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {user.studentLinks.map(({ student }) => (
        <span key={student.id} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
          {student.full_name}
          <button
            type="button"
            aria-label={`Remove ${student.full_name}`}
            className="rounded-full hover:text-danger"
            onClick={() => unlink.mutate({ profileId: user.id, studentId: student.id })}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {addable.length > 0 && (
        <NativeSelect
          aria-label={`Link a student to ${user.email}`}
          className="h-7 w-auto text-xs"
          value=""
          onChange={(e) => e.target.value && link.mutate({ profileId: user.id, studentId: e.target.value })}
        >
          <option value="">+ Link student</option>
          {addable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )
}

export default function UsersPage() {
  const users = useUsers()
  const studentOptions = useStudentOptions()
  const setRole = useSetUserRole()

  const columns: Column<UserAccount>[] = [
    {
      key: 'name',
      header: 'Account',
      cell: (u) => (
        <div>
          <div className="font-medium">{u.full_name || '—'}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) =>
        u.role === ROLES.ADMIN ? (
          <StatusBadge status={u.role} />
        ) : (
          <NativeSelect
            aria-label={`Role for ${u.email}`}
            className="h-8 w-32"
            value={u.role}
            disabled={setRole.isPending}
            onChange={(e) => setRole.mutate({ user: u, role: e.target.value as Exclude<Role, 'admin'> })}
          >
            <option value={ROLES.STUDENT}>Student</option>
            <option value={ROLES.TEACHER}>Teacher</option>
          </NativeSelect>
        ),
    },
    { key: 'linked', header: 'Linked to', cell: (u) => <LinkedTo user={u} studentOptions={studentOptions.data} /> },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Every login starts as a student. Switch teachers to Teacher here; admins can only be changed in the database."
      />
      <DataTable
        columns={columns}
        data={users.data}
        isLoading={users.isLoading}
        error={users.error}
        onRetry={users.refetch}
        emptyTitle="No accounts yet"
      />
    </>
  )
}
