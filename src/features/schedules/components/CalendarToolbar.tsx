import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CALENDAR_VIEWS, viewTitle, type CalendarView } from '@/utils/calendar'

export function CalendarToolbar({
  view,
  date,
  onNavigate,
  onToday,
  onViewChange,
  children,
}: {
  view: CalendarView
  date: string
  onNavigate: (direction: -1 | 1) => void
  onToday: () => void
  onViewChange: (view: CalendarView) => void
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => onNavigate(-1)} aria-label="Previous">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onNavigate(1)} aria-label="Next">
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={onToday}>
            Today
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold" aria-live="polite">
          {viewTitle(view, date)}
        </h2>
        <div className="inline-flex rounded-md border bg-muted p-0.5" role="group" aria-label="Calendar view">
          {CALENDAR_VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => onViewChange(v.value)}
              aria-pressed={view === v.value}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium text-muted-foreground transition-colors',
                view === v.value ? 'bg-card text-foreground shadow-xs' : 'hover:text-foreground',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {children && <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>}
    </div>
  )
}
