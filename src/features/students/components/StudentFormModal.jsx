import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/common/FormField'
import { FormModal } from '@/components/common/FormModal'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { GRADES, STUDENT_STATUSES } from '@/constants/options'
import { studentDefaults, studentSchema, studentToForm } from '@/schemas/student'
import { useSaveStudent } from '../hooks'

const FORM_ID = 'student-form'

export function StudentFormModal({ open, onOpenChange, student }) {
  const isEdit = Boolean(student)
  const save = useSaveStudent({ onSuccess: () => onOpenChange(false) })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(studentSchema), defaultValues: studentDefaults })

  useEffect(() => {
    if (open) reset(student ? studentToForm(student) : studentDefaults)
  }, [open, student, reset])

  const onSubmit = (values) => save.mutate({ id: student?.id, values })

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit student' : 'Add student'}
      formId={FORM_ID}
      submitLabel={isEdit ? 'Save changes' : 'Create student'}
      isSubmitting={save.isPending}
      className="max-w-2xl"
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="full_name" error={errors.full_name} required>
          <Input id="full_name" aria-invalid={Boolean(errors.full_name)} {...register('full_name')} />
        </FormField>
        <FormField label="Grade" htmlFor="grade" error={errors.grade}>
          <NativeSelect id="grade" {...register('grade')}>
            <option value="">Not set</option>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
        </FormField>
        <FormField label="Parent name" htmlFor="parent_name" error={errors.parent_name}>
          <Input id="parent_name" {...register('parent_name')} />
        </FormField>
        <FormField label="Parent phone" htmlFor="parent_phone" error={errors.parent_phone}>
          <Input id="parent_phone" type="tel" aria-invalid={Boolean(errors.parent_phone)} {...register('parent_phone')} />
        </FormField>
        <FormField label="Status" htmlFor="status" error={errors.status}>
          <NativeSelect id="status" {...register('status')}>
            {STUDENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
          <Textarea id="notes" rows={3} {...register('notes')} />
        </FormField>
      </form>
    </FormModal>
  )
}
