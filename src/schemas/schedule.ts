import { z } from 'zod'
import { appZoneInputToISO, formatInAppZone } from '@/utils/datetime'

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time')

/**
 * Form shape: one date + start/end times (all Ho Chi Minh wall time).
 * Classes end on the day they start; 'HH:mm' strings compare correctly as text.
 * The database re-checks end > start, the 12-hour cap and overlaps.
 */
const scheduleFields = z.object({
  student_id: z.string().uuid('Choose a student'),
  title: z.string().trim().min(1, 'Title is required').max(120),
  subject: z.string().trim().min(1, 'Subject is required').max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  start: time,
  end: time,
  location: z.string().trim().max(120),
  notes: z.string().trim().max(2000),
})

function checkTimes({ start, end }: { start: string; end: string }, ctx: z.RefinementCtx) {
  if (end <= start) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'End time must be later than start time' })
  } else if (minutes(end) - minutes(start) > 12 * 60) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'A class cannot be longer than 12 hours' })
  }
}

export const scheduleSchema = scheduleFields.superRefine(checkTimes)

/** The admin also picks the teacher (a teacher always schedules for themselves). */
export const adminScheduleSchema = scheduleFields
  .extend({ teacher_id: z.string().uuid('Choose a teacher') })
  .superRefine(checkTimes)

/** Form values. `teacher_id` is only used (and validated) in the admin form. */
export type ScheduleFormInput = z.input<typeof scheduleFields> & { teacher_id?: string }
export type ScheduleFormOutput = z.output<typeof scheduleFields> & { teacher_id?: string }

/** What the form sends to the schedules service. */
export type ScheduleValues = Omit<ScheduleFormOutput, 'date' | 'start' | 'end'> & {
  start_time: string
  end_time: string
}

export const scheduleDefaults: ScheduleFormInput = {
  teacher_id: '',
  student_id: '',
  title: '',
  subject: '',
  date: '',
  start: '',
  end: '',
  location: '',
  notes: '',
}

/** Validated form values → columns for the schedules table. */
export function formToSchedule({ date, start, end, ...rest }: ScheduleFormOutput): ScheduleValues {
  const startTime = appZoneInputToISO(`${date}T${start}`)
  const endTime = appZoneInputToISO(`${date}T${end}`)
  // Unreachable after validation (date and times are format-checked); keeps the types honest.
  if (!startTime || !endTime) throw new Error('Invalid class date or time')
  return { ...rest, start_time: startTime, end_time: endTime }
}

/** Schedule row → form values. */
export function scheduleToForm(schedule: {
  teacher_id?: string
  student_id: string
  title: string
  subject: string
  start_time: string
  end_time: string
  location: string | null
  notes: string | null
}): ScheduleFormInput {
  return {
    teacher_id: schedule.teacher_id,
    student_id: schedule.student_id,
    title: schedule.title,
    subject: schedule.subject,
    date: formatInAppZone(schedule.start_time, 'yyyy-MM-dd'),
    start: formatInAppZone(schedule.start_time, 'HH:mm'),
    end: formatInAppZone(schedule.end_time, 'HH:mm'),
    location: schedule.location ?? '',
    notes: schedule.notes ?? '',
  }
}
