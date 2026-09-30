import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/common/States'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useTeacherOptions } from '@/features/teachers/hooks'
import { useSetStudentTeachers, useStudentTeacherIds } from '../hooks'

/** Tick the teachers a student works with; saved atomically through the set_student_teachers RPC. */
export function AssignTeachersDialog({ student, onOpenChange }) {
  const open = Boolean(student)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign teachers</DialogTitle>
          <DialogDescription>
            Choose who teaches {student?.full_name}. Teachers can only schedule and bill students assigned to them.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by student so the checkbox state resets for each student. */}
        {open && <AssignForm key={student.id} student={student} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ student, onDone }) {
  const teachersQuery = useTeacherOptions()
  const assignedQuery = useStudentTeacherIds(student.id)
  const save = useSetStudentTeachers({ onSuccess: onDone })
  const [selected, setSelected] = useState(null) // null until the user changes something

  if (teachersQuery.isPending || assignedQuery.isPending) return <LoadingState rows={4} className="p-0" />
  const error = teachersQuery.error ?? assignedQuery.error
  if (error) return <ErrorState error={error} onRetry={() => { teachersQuery.refetch(); assignedQuery.refetch() }} />

  const current = selected ?? new Set(assignedQuery.data)
  const toggle = (id) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  // Inactive teachers can't be newly assigned, but existing assignments stay visible so they can be removed.
  const teachers = teachersQuery.data.filter((t) => t.status !== 'inactive' || current.has(t.id))

  return (
    <>
      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
        {teachers.length === 0 && <li className="p-4 text-sm text-muted-foreground">No active teachers yet.</li>}
        {teachers.map((teacher) => (
          <li key={teacher.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={current.has(teacher.id)}
                onChange={() => toggle(teacher.id)}
              />
              <span className="flex-1 text-sm">{teacher.full_name}</span>
              {teacher.status !== 'active' && <StatusBadge status={teacher.status} />}
            </label>
          </li>
        ))}
      </ul>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => save.mutate({ studentId: student.id, teacherIds: [...current] })}
          disabled={save.isPending || selected === null}
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          Save assignments
        </Button>
      </DialogFooter>
    </>
  )
}
