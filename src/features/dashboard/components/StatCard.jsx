import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** One headline number. Meaning comes from the label + icon, never from colour alone. */
export function StatCard({ icon: Icon, label, value, hint, isLoading, iconClassName = 'bg-primary-soft text-primary' }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn('rounded-md p-1.5', iconClassName)}>
          <Icon className="size-4" aria-hidden />
        </div>
      </div>
      {isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
