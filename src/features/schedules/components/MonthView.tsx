import { cn } from '@/lib/utils'
import type { Schedule } from '@/services/schedulesService'
import { dayKey, daysBetween, eventsForDay, parseDayKey, todayKey, type DateRange } from '@/utils/calendar'
import { formatInAppZone, formatTime } from '@/utils/datetime'
import { eventColor } from './eventStyle'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3

export function MonthView({
  range,
  anchorKey,
  schedules,
  onEventClick,
  onDayClick,
}: {
  range: DateRange
  anchorKey: string
  schedules: Schedule[]
  onEventClick: (schedule: Schedule) => void
  onDayClick: (dayKey: string) => void
}) {
  const days = daysBetween(range.from, range.to)
  const month = formatInAppZone(parseDayKey(anchorKey), 'yyyy-MM')
  const today = todayKey()

  return (
    <div>
      <div className="grid grid-cols-7 border-b bg-muted/60 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day)
          const events = eventsForDay(schedules, day).map((e) => e.schedule)
          const inMonth = key.startsWith(month)
          return (
            <div
              key={key}
              className={cn('min-h-20 border-b border-r p-1 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-muted/40')}
            >
              <button
                type="button"
                onClick={() => onDayClick(key)}
                className={cn(
                  'mb-1 flex size-6 items-center justify-center rounded-full text-xs hover:bg-muted',
                  !inMonth && 'text-muted-foreground',
                  key === today && 'bg-primary font-semibold text-primary-foreground hover:bg-primary-hover',
                )}
                aria-label={`Open ${formatInAppZone(day, 'dd MMMM')} in day view`}
              >
                {formatInAppZone(day, 'd')}
              </button>

              {/* Phones: just a count. Larger screens: the first few classes. */}
              {events.length > 0 && (
                <button type="button" onClick={() => onDayClick(key)} className="text-xs font-medium text-primary sm:hidden">
                  {events.length} class{events.length > 1 ? 'es' : ''}
                </button>
              )}
              <div className="hidden space-y-1 sm:block">
                {events.slice(0, MAX_VISIBLE).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onEventClick(s)}
                    className={cn('block w-full truncate rounded border-l-2 px-1.5 py-0.5 text-left text-xs', eventColor(s.teacher_id))}
                    title={`${formatTime(s.start_time)} ${s.title}`}
                  >
                    <span className="tabular-nums">{formatTime(s.start_time)}</span> {s.title}
                  </button>
                ))}
                {events.length > MAX_VISIBLE && (
                  <button type="button" onClick={() => onDayClick(key)} className="text-xs text-muted-foreground hover:text-foreground">
                    +{events.length - MAX_VISIBLE} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
