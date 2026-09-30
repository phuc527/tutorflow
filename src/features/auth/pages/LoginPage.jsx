import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/common/FormField'
import { APP_NAME } from '@/constants/app'
import { isSupabaseConfigured } from '@/lib/supabase'
import { loginSchema } from '@/schemas/auth'
import { useAuth } from '../authContext'

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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Accounts are created by your tutoring center administrator.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isSupabaseConfigured && (
              <p className="mb-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
                Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
              </p>
            )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
