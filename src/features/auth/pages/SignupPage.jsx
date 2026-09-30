import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { AlertCircle, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/common/FormField'
import { signupSchema } from '@/schemas/auth'
import { useAuth } from '../authContext'
import { AuthShell } from '../components/AuthShell'

const signInLink = (
  <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
    Sign in
  </Link>
)

export default function SignupPage() {
  const { signUp } = useAuth()
  const [submitError, setSubmitError] = useState(null)
  const [sentTo, setSentTo] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async ({ fullName, email, password }) => {
    setSubmitError(null)
    try {
      await signUp({ fullName, email, password })
      setSentTo(email)
    } catch (error) {
      setSubmitError(error.message)
    }
  }

  // Shown for new AND already-registered emails alike (Supabase answers both the same way).
  if (sentTo) {
    return (
      <AuthShell title="Check your email" footer={<>Already confirmed? {signInLink}</>}>
        <div className="flex items-start gap-3 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to activate your account. You’ll be
            signed in automatically.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      description="For students, parents and teachers. Use the email your tutoring center has on file."
      footer={<>Already have an account? {signInLink}</>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <FormField label="Full name" htmlFor="fullName" error={errors.fullName}>
          <Input id="fullName" autoComplete="name" autoFocus aria-invalid={Boolean(errors.fullName)} {...register('fullName')} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </FormField>

        {submitError && (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
