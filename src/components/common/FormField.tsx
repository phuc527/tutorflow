import type { ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label + control + validation message. Pass the react-hook-form error for this field as `error`. */
interface FormFieldProps {
  label?: ReactNode
  htmlFor?: string
  error?: Pick<FieldError, 'message'>
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error.message}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
