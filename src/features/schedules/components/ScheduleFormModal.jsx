import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/common/FormField'
import { FormModal } from '@/components/common/FormModal'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { useStudentOptions } from '@/features/students/hooks'
import { formToSchedule, scheduleDefaults, scheduleSchema, scheduleToForm } from '@/schemas/schedule'
import { useSaveSchedule } from '../hooks'

const FORM_ID = 'schedule-form'

function plusOneHour(time) {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Create or edit a class. `schedule` = row to edit; `initial` = { date, start } prefill from a calendar click.
 * The student list comes from RLS: a teacher can only ever load their assigned students.
 */
export function ScheduleFormModal({ open, onOpenChange, schedule, initial, teacherId }) {
  const isEdit = Boolean(schedule)
  const studentsQuery = useStudentOptions({ enabled: open })
  const save = useSaveSchedule({ teacherId, onSuccess: () => onOpenChange(false) })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(scheduleSchema), defaultValues: scheduleDefaults })

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

  const students = (studentsQuery.data ?? []).filter((s) => s.status === 'active' || s.id === schedule?.student_id)

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
        <FormField label="Student" htmlFor="student_id" error={errors.student_id} required className="sm:col-span-2">
          <NativeSelect id="student_id" aria-invalid={Boolean(errors.student_id)} disabled={studentsQuery.isPending} {...register('student_id')}>
            <option value="">{studentsQuery.isPending ? 'Loading…' : 'Choose a student'}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.grade ? ` (Grade ${s.grade})` : ''}
              </option>
            ))}
          </NativeSelect>
          {!studentsQuery.isPending && students.length === 0 && (
            <p className="text-xs text-warning">No students are assigned to you yet. Ask your administrator.</p>
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
