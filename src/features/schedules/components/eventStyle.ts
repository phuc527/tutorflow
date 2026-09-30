import type { TimedEvent } from '@/utils/calendar'
import { formatTime } from '@/utils/datetime'

// Full class strings (not built dynamically) so Tailwind can see and generate them.
const PALETTE = [
  'border-l-blue-600 bg-blue-50 text-blue-900 hover:bg-blue-100',
  'border-l-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  'border-l-violet-600 bg-violet-50 text-violet-900 hover:bg-violet-100',
  'border-l-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100',
  'border-l-rose-600 bg-rose-50 text-rose-900 hover:bg-rose-100',
  'border-l-cyan-600 bg-cyan-50 text-cyan-900 hover:bg-cyan-100',
]

/** Stable colour per teacher, so an admin can tell teachers apart at a glance. */
export function eventColor(teacherId = '') {
  let hash = 0
  for (const char of teacherId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

export function timeRange(schedule: TimedEvent) {
  return `${formatTime(schedule.start_time)}–${formatTime(schedule.end_time)}`
}

/** Student name, or a placeholder when RLS hides the student (e.g. they were unassigned afterwards). */
export function studentName(schedule: { student: { full_name: string } | null }) {
  return schedule.student?.full_name ?? 'Student no longer assigned'
}
