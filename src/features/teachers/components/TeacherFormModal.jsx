import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/common/FormField'
import { FormModal } from '@/components/common/FormModal'
import { Input, NativeSelect } from '@/components/ui/input'
import { TEACHER_STATUSES } from '@/constants/options'
import { teacherDefaults, teacherSchema } from '@/schemas/teacher'
import { useSaveTeacher } from '../hooks'

const FORM_ID = 'teacher-form'

/** Create (teacher = null) or edit (teacher = row) in one modal. */
export function TeacherFormModal({ open, onOpenChange, teacher }) {
  const isEdit = Boolean(teacher)
  const save = useSaveTeacher({ onSuccess: () => onOpenChange(false) })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(teacherSchema), defaultValues: teacherDefaults })

  // Load the row being edited (or blank values) each time the modal opens.
  useEffect(() => {
    if (!open) return
    reset(
      teacher
        ? Object.fromEntries(Object.keys(teacherDefaults).map((key) => [key, teacher[key] ?? teacherDefaults[key]]))
        : teacherDefaults,
    )
  }, [open, teacher, reset])

  const onSubmit = (values) => save.mutate({ id: teacher?.id, values })

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit teacher' : 'Add teacher'}
      description={
        isEdit
          ? undefined
          : 'To give this teacher a login, create an auth user with the same email. It is linked automatically.'
      }
      formId={FORM_ID}
      submitLabel={isEdit ? 'Save changes' : 'Create teacher'}
      isSubmitting={save.isPending}
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="full_name" error={errors.full_name} required className="sm:col-span-2">
          <Input id="full_name" aria-invalid={Boolean(errors.full_name)} {...register('full_name')} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email} required>
          <Input id="email" type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
        </FormField>
        <FormField label="Specialization" htmlFor="specialization" error={errors.specialization}>
          <Input id="specialization" placeholder="e.g. Mathematics" {...register('specialization')} />
        </FormField>
        <FormField label="Hourly rate (VND)" htmlFor="hourly_rate" error={errors.hourly_rate}>
          <Input
            id="hourly_rate"
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            aria-invalid={Boolean(errors.hourly_rate)}
            {...register('hourly_rate')}
          />
        </FormField>
        <FormField label="Status" htmlFor="status" error={errors.status}>
          <NativeSelect id="status" {...register('status')}>
            {TEACHER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </form>
    </FormModal>
  )
}
