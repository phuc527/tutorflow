import { CalendarX, MapPin } from 'lucide-react'
import { EmptyState } from '@/components/common/States'
import { cn } from '@/lib/utils'
import type { Schedule } from '@/services/schedulesService'
import { dayKey, todayKey } from '@/utils/calendar'
import { formatInAppZone } from '@/utils/datetime'
import { eventColor, studentName, timeRange } from './eventStyle'

/** Agenda: classes grouped by day, in the app timezone. */
export function ScheduleListView({
  schedules,
  onEventClick,
  showTeacher,
}: {
  schedules: Schedule[]
  onEventClick: (schedule: Schedule) => void
  showTeacher: boolean
}) {
  if (!schedules.length) {
    return <EmptyState icon={CalendarX} title="No classes in this period" description="Try another month or clear the filters." />
  }

  const groups = new Map<string, Schedule[]>()
  for (const s of schedules) {
    const key = dayKey(s.start_time)
    const group = groups.get(key)
    if (group) group.push(s)
    else groups.set(key, [s])
  }
  const today = todayKey()

  return (
    <div className="divide-y">
      {[...groups.entries()].map(([key, items]) => (
        <section key={key}>
          <h3 className={cn('bg-muted/80 px-4 py-2 text-sm font-semibold', key === today && 'text-primary')}>
            {formatInAppZone(items[0]!.start_time, 'EEEE, dd/MM/yyyy')}
            {key === today && <span className="ml-2 text-xs font-normal">Today</span>}
          </h3>
          <ul>
            {items.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onEventClick(s)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className={cn('w-28 shrink-0 rounded border-l-4 px-2 py-0.5 text-sm tabular-nums', eventColor(s.teacher_id))}>
                    {timeRange(s)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {s.title} <span className="font-normal text-muted-foreground">· {s.subject}</span>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {studentName(s)}
                      {showTeacher && s.teacher && ` with ${s.teacher.full_name}`}
                    </span>
                  </span>
                  {s.location && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {s.location}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
