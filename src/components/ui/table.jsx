import { cn } from '@/lib/utils'

/** The wrapper scrolls horizontally on small screens instead of squashing columns. */
export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('bg-muted/60', className)} {...props} />
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/40', className)} {...props} />
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />
}
