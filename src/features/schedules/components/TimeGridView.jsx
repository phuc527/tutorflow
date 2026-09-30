import { cn } from '@/lib/utils'
import { dayKey, eventsForDay, layoutDayEvents, todayKey, toAppZone } from '@/utils/calendar'
import { formatInAppZone } from '@/utils/datetime'
import { eventColor, studentName, timeRange } from './eventStyle'

const HOUR_HEIGHT = 48 // px per hour
const DEFAULT_START_HOUR = 7
const DEFAULT_END_HOUR = 21

/** Visible hours: 07–21 by default, stretched if any class falls outside. */
function hourBounds(dayEvents) {
  let start = DEFAULT_START_HOUR
  let end = DEFAULT_END_HOUR
  for (const events of dayEvents) {
    for (const e of events) {
      start = Math.min(start, Math.floor(e.start / 60))
      end = Math.max(end, Math.ceil(e.end / 60))
    }
  }
  return { start, end }
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * Week (7 columns) or day (1 column) time grid.
 * onSlotClick(dayKey, 'HH:mm') is only passed for users who may create schedules.
 */
export function TimeGridView({ days, schedules, onEventClick, onSlotClick }) {
  const perDay = days.map((day) => layoutDayEvents(eventsForDay(schedules, day)))
  const { start: startHour, end: endHour } = hourBounds(perDay)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const today = todayKey()

  const now = toAppZone(new Date())
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const handleSlotClick = (event, key) => {
    if (!onSlotClick || event.target !== event.currentTarget) return
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top
    // Snap to the half hour that was clicked.
    const minutes = startHour * 60 + Math.floor((y / HOUR_HEIGHT) * 2) * 30
    onSlotClick(key, `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn(days.length > 1 && 'min-w-[720px]')}>
        {/* Day headers */}
        <div className="flex border-b bg-muted/60">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const key = dayKey(day)
            return (
              <div key={key} className="flex-1 border-l py-2 text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{formatInAppZone(day, 'EEE')}</div>
                <div className={cn('text-sm font-semibold', key === today && 'text-primary')}>{formatInAppZone(day, 'dd/MM')}</div>
              </div>
            )
          })}
        </div>

        <div className="flex">
          {/* Hour labels */}
          <div className="w-14 shrink-0">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="-translate-y-2 pr-2 text-right text-xs text-muted-foreground tabular-nums">
                {pad(h)}:00
              </div>
            ))}
          </div>

          {days.map((day, index) => {
            const key = dayKey(day)
            return (
              <div
                key={key}
                className={cn('relative flex-1 border-l', onSlotClick && 'cursor-pointer')}
                style={{
                  height: hours.length * HOUR_HEIGHT,
                  // Hour lines drawn with a repeating gradient instead of dozens of divs.
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
                }}
                onClick={(e) => handleSlotClick(e, key)}
                title={onSlotClick ? 'Click an empty slot to add a class' : undefined}
              >
                {key === today && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger"
                    style={{ top: ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT }}
                    aria-hidden
                  />
                )}

                {perDay[index].map(({ schedule, start, end, lane, laneCount }) => {
                  const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT
                  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 2, 18)
                  return (
                    <button
                      key={schedule.id}
                      type="button"
                      onClick={() => onEventClick(schedule)}
                      className={cn(
                        'absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-xs shadow-xs',
                        eventColor(schedule.teacher_id),
                      )}
                      style={{
                        top: top + 1,
                        height,
                        left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                        width: `calc(${100 / laneCount}% - 4px)`,
                      }}
                    >
                      <div className="truncate font-semibold">{schedule.title}</div>
                      <div className="truncate tabular-nums opacity-80">{timeRange(schedule)}</div>
                      <div className="truncate opacity-80">{studentName(schedule)}</div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
