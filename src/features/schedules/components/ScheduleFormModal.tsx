import { useEffect } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/common/FormField'
import { FormModal } from '@/components/common/FormModal'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { useStudentOptions } from '@/features/students/hooks'
import { useTeacherOptions, useTeacherStudentIds } from '@/features/teachers/hooks'
import {
  adminScheduleSchema,
  formToSchedule,
  scheduleDefaults,
  scheduleSchema,
  scheduleToForm,
  type ScheduleFormInput,
  type ScheduleFormOutput,
} from '@/schemas/schedule'
import type { Schedule } from '@/services/schedulesService'
import { useSaveSchedule } from '../hooks'

const FORM_ID = 'schedule-form'

function plusOneHour(time: string) {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Create or edit a class. `schedule` = row to edit; `initial` = { date, start } prefill from a calendar click.
 * A teacher schedules for themselves: RLS only ever returns their assigned students.
 * The admin (`chooseTeacher`) picks the teacher first; students are narrowed to that teacher's assignments.
 * A class keeps its teacher once created.
 */
export function ScheduleFormModal({
  open,
  onOpenChange,
  schedule,
  initial,
  teacherId,
  chooseTeacher = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: Schedule | null
  initial: { date: string; start: string } | null
  teacherId: string | null
  chooseTeacher?: boolean
}) {
  const isEdit = Boolean(schedule)
  const studentsQuery = useStudentOptions({ enabled: open })
  const teachersQuery = useTeacherOptions({ enabled: open && chooseTeacher })
  const save = useSaveSchedule({ teacherId, onSuccess: () => onOpenChange(false) })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<ScheduleFormInput, unknown, ScheduleFormOutput>({
    // The two schemas share one form shape; the admin one also requires teacher_id.
    resolver: zodResolver(chooseTeacher ? adminScheduleSchema : scheduleSchema) as Resolver<
      ScheduleFormInput,
      unknown,
      ScheduleFormOutput
    >,
    defaultValues: scheduleDefaults,
  })

  const selectedTeacherId = useWatch({ control, name: 'teacher_id' })
  const assignedQuery = useTeacherStudentIds(selectedTeacherId, { enabled: open && chooseTeacher })

  useEffect(() => {
    if (!open) return
    if (schedule) reset(scheduleToForm(schedule))
    else
      reset({
        ...scheduleDefaults,
        date: initial?.date ?? '',
        start: initial?.start ?? '',
        end: initial?.start ? plusOneHour(initial.start) : '',
      })
  }, [open, schedule, initial, reset])

  const assignedIds = chooseTeacher ? new Set(assignedQuery.data ?? []) : null
  const students = (studentsQuery.data ?? []).filter(
    (s) => (s.status === 'active' || s.id === schedule?.student_id) && (!assignedIds || assignedIds.has(s.id)),
  )
  const teachers = (teachersQuery.data ?? []).filter((t) => t.status !== 'inactive' || t.id === schedule?.teacher_id)
  const studentsPending = studentsQuery.isPending || (chooseTeacher && Boolean(selectedTeacherId) && assignedQuery.isPending)
  const needsTeacher = chooseTeacher && !selectedTeacherId

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit class' : 'New class'}
      description="Times are in Vietnam time (GMT+7)."
      formId={FORM_ID}
      submitLabel={isEdit ? 'Save changes' : 'Create class'}
      isSubmitting={save.isPending}
      className="max-w-xl"
    >
      <form
        id={FORM_ID}
        onSubmit={handleSubmit((values) => save.mutate({ id: schedule?.id, values: formToSchedule(values) }))}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        {chooseTeacher && (
          <FormField label="Teacher" htmlFor="teacher_id" error={errors.teacher_id} required className="sm:col-span-2">
            {isEdit ? (
              <Input id="teacher_id" value={schedule?.teacher?.full_name ?? ''} readOnly />
            ) : (
              <NativeSelect
                id="teacher_id"
                aria-invalid={Boolean(errors.teacher_id)}
                disabled={teachersQuery.isPending}
                {...register('teacher_id', { onChange: () => setValue('student_id', '') })}
              >
                <option value="">{teachersQuery.isPending ? 'Loading…' : 'Choose a teacher'}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {teachersQuery.error && (
              <p className="text-xs text-danger" role="alert">
                Couldn’t load teachers: {teachersQuery.error.message}
              </p>
            )}
          </FormField>
        )}
        <FormField label="Student" htmlFor="student_id" error={errors.student_id} required className="sm:col-span-2">
          <NativeSelect
            id="student_id"
            aria-invalid={Boolean(errors.student_id)}
            disabled={needsTeacher || studentsPending}
            {...register('student_id')}
          >
            <option value="">
              {needsTeacher ? 'Choose a teacher first' : studentsPending ? 'Loading…' : 'Choose a student'}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.grade ? ` (Grade ${s.grade})` : ''}
              </option>
            ))}
          </NativeSelect>
          {(studentsQuery.error || assignedQuery.error) && (
            <p className="text-xs text-danger" role="alert">
              Couldn’t load students: {(studentsQuery.error ?? assignedQuery.error)?.message}
            </p>
          )}
          {!needsTeacher && !studentsPending && !studentsQuery.error && students.length === 0 && (
            <p className="text-xs text-warning">
              {chooseTeacher
                ? 'No active students are assigned to this teacher. Assign them on the Students page.'
                : 'No students are assigned to you yet. Ask your administrator.'}
            </p>
          )}
        </FormField>
        <FormField label="Title" htmlFor="title" error={errors.title} required>
          <Input id="title" placeholder="e.g. Algebra review" aria-invalid={Boolean(errors.title)} {...register('title')} />
        </FormField>
        <FormField label="Subject" htmlFor="subject" error={errors.subject} required>
          <Input id="subject" placeholder="e.g. Mathematics" aria-invalid={Boolean(errors.subject)} {...register('subject')} />
        </FormField>
        <FormField label="Date" htmlFor="date" error={errors.date} required className="sm:col-span-2">
          <Input id="date" type="date" aria-invalid={Boolean(errors.date)} {...register('date')} />
        </FormField>
        <FormField label="Start" htmlFor="start" error={errors.start} required>
          <Input id="start" type="time" step={300} aria-invalid={Boolean(errors.start)} {...register('start')} />
        </FormField>
        <FormField label="End" htmlFor="end" error={errors.end} required>
          <Input id="end" type="time" step={300} aria-invalid={Boolean(errors.end)} {...register('end')} />
        </FormField>
        <FormField label="Location" htmlFor="location" error={errors.location} className="sm:col-span-2">
          <Input id="location" placeholder="e.g. Room 2 or Online" {...register('location')} />
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
          <Textarea id="notes" rows={2} {...register('notes')} />
        </FormField>
      </form>
    </FormModal>
  )
}
