import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { APP_TIMEZONE } from '@/constants/app'
import { formatInAppZone } from './datetime'

/*
  Calendar math, always in the app timezone.
  date-fns functions given a TZDate do their day/week/month arithmetic in that TZDate's zone,
  so "start of week" means Monday 00:00 in Ho Chi Minh City even on a laptop set to New York.
  Days are identified by 'yyyy-MM-dd' keys (what goes in the URL).
*/

export type CalendarView = 'month' | 'week' | 'day' | 'list'

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'list', label: 'List' },
]

const WEEK_OPTIONS = { weekStartsOn: 1 } as const // Monday

export interface DateRange {
  from: Date
  to: Date
}

/** Anything with a start and end instant (a schedule row, a portal class…). */
export interface TimedEvent {
  start_time: string
  end_time: string
}

/** An event placed in one day column, in minutes from that day's midnight. */
export interface DayEvent<T extends TimedEvent = TimedEvent> {
  schedule: T
  start: number
  end: number
}

/** Any instant → a Date whose calendar fields (getHours, getDate…) read in the app timezone. */
export function toAppZone(value: Date | string | number) {
  return new TZDate(new Date(value).getTime(), APP_TIMEZONE)
}

export const dayKey = (value: Date | string | number) => formatInAppZone(value, 'yyyy-MM-dd')
export const todayKey = () => dayKey(new Date())

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDayKey(value).getTime())
}

/** 'yyyy-MM-dd' → midnight of that day in the app timezone. */
export function parseDayKey(key: string) {
  const [y = NaN, m = NaN, d = NaN] = key.split('-').map(Number)
  return new TZDate(y, m - 1, d, APP_TIMEZONE)
}

/** Half-open [from, to) interval of instants that a view shows. */
export function getViewRange(view: CalendarView, anchorKey: string): DateRange {
  const anchor = parseDayKey(anchorKey)
  switch (view) {
    case 'day': {
      const from = startOfDay(anchor)
      return { from, to: addDays(from, 1) }
    }
    case 'week': {
      const from = startOfWeek(anchor, WEEK_OPTIONS)
      return { from, to: addDays(from, 7) }
    }
    case 'month': {
      // Whole weeks covering the month, as the grid displays them.
      const from = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS)
      const to = startOfDay(addDays(endOfWeek(endOfMonth(anchor), WEEK_OPTIONS), 1))
      return { from, to }
    }
    default: {
      const from = startOfMonth(anchor)
      return { from, to: addMonths(from, 1) }
    }
  }
}

/** Move the anchor one view-length backwards (-1) or forwards (+1). */
export function shiftAnchor(view: CalendarView, anchorKey: string, direction: number) {
  const anchor = parseDayKey(anchorKey)
  if (view === 'day') return dayKey(addDays(anchor, direction))
  if (view === 'week') return dayKey(addWeeks(anchor, direction))
  return dayKey(addMonths(anchor, direction))
}

export function viewTitle(view: CalendarView, anchorKey: string) {
  const { from, to } = getViewRange(view, anchorKey)
  if (view === 'day') return formatInAppZone(from, 'EEEE, dd MMM yyyy')
  if (view === 'week') return `${formatInAppZone(from, 'dd MMM')} – ${formatInAppZone(addDays(to, -1), 'dd MMM yyyy')}`
  return formatInAppZone(parseDayKey(anchorKey), 'MMMM yyyy')
}

/** Each day (as TZDate midnights) in [from, to). */
export function daysBetween(from: Date, to: Date) {
  return eachDayOfInterval({ start: from, end: addDays(to, -1) })
}

/**
 * Schedules that touch the given day, with start/end converted to minutes from that day's midnight
 * and clipped to [0, 1440] (a class may cross midnight).
 */
export function eventsForDay<T extends TimedEvent>(schedules: T[], day: Date): DayEvent<T>[] {
  const dayStart = startOfDay(day).getTime()
  const dayEnd = addDays(startOfDay(day), 1).getTime()
  return schedules
    .filter((s) => new Date(s.start_time).getTime() < dayEnd && new Date(s.end_time).getTime() > dayStart)
    .map((s) => ({
      schedule: s,
      start: Math.max(0, (new Date(s.start_time).getTime() - dayStart) / 60_000),
      end: Math.min(1440, (new Date(s.end_time).getTime() - dayStart) / 60_000),
    }))
}

/**
 * Side-by-side layout for overlapping events in one day column (an admin sees several teachers at once).
 * Events that overlap, directly or through a chain, form a cluster; each gets the first free lane,
 * and every event in a cluster shares the cluster's lane count so widths line up.
 * Returns events with `lane` and `laneCount`.
 */
export function layoutDayEvents<E extends { start: number; end: number }>(events: E[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end)
  const result: (E & { lane: number; laneCount: number })[] = []
  let cluster: (E & { lane: number })[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    for (const item of cluster) result.push({ ...item, laneCount: laneEnds.length })
    cluster = []
    laneEnds = []
  }

  for (const event of sorted) {
    if (event.start >= clusterEnd) {
      flush()
      clusterEnd = -Infinity
    }
    let lane = laneEnds.findIndex((end) => end <= event.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(event.end)
    } else {
      laneEnds[lane] = event.end
    }
    cluster.push({ ...event, lane })
    clusterEnd = Math.max(clusterEnd, event.end)
  }
  flush()
  return result
}
