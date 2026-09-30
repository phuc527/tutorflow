import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/common/FormField'
import { loginSchema } from '@/schemas/auth'
import { useAuth } from '../authContext'
import { AuthShell } from '../components/AuthShell'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [submitError, setSubmitError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  // No navigate() here: on success Supabase emits SIGNED_IN, the session updates,
  // and <GuestOnly> redirects to the page the user originally asked for.
  const onSubmit = async (values) => {
    setSubmitError(null)
    try {
      await signIn(values)
    } catch (error) {
      setSubmitError(error.message)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      description="Teachers added by your tutoring center can create their own account."
      footer={
        <>
          New teacher?{' '}
          <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
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
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
