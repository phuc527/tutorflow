import { BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_NAME } from '@/constants/app'
import { isSupabaseConfigured } from '@/lib/supabase'

/** Centered logo + card used by the logged-out pages (sign in, sign up). */
export function AuthShell({ title, description, children, footer }) {
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
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>
            {!isSupabaseConfigured && (
              <p className="mb-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
                Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
              </p>
            )}
            {children}
          </CardContent>
        </Card>

        {footer && <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  )
}
