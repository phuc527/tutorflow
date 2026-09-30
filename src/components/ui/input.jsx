import { cn } from '@/lib/utils'

export const fieldClasses =
  'flex w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger'

export function Input({ className, type = 'text', ...props }) {
  return <input type={type} className={cn(fieldClasses, 'h-9 py-1', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(fieldClasses, 'py-2', className)} {...props} />
}

/** Styled native <select>: accessible, mobile-friendly, and works with react-hook-form's register(). */
export function NativeSelect({ className, children, ...props }) {
  return (
    <select className={cn(fieldClasses, 'h-9 py-1 pr-8', className)} {...props}>
      {children}
    </select>
  )
}
