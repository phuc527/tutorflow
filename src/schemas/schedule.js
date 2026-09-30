import { z } from 'zod'
import { appZoneInputToISO, formatInAppZone } from '@/utils/datetime'

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
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

const withTimeRules = (schema) =>
  schema
    .refine((v) => v.end > v.start, { path: ['end'], message: 'End time must be later than start time' })
    .refine((v) => v.end <= v.start || minutes(v.end) - minutes(v.start) <= 12 * 60, {
      path: ['end'],
      message: 'A class cannot be longer than 12 hours',
    })

export const scheduleSchema = withTimeRules(scheduleFields)

/** The admin also picks the teacher (a teacher always schedules for themselves). */
export const adminScheduleSchema = withTimeRules(
  scheduleFields.extend({ teacher_id: z.string().uuid('Choose a teacher') }),
)

export const scheduleDefaults = {
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
export function formToSchedule({ date, start, end, ...rest }) {
  return {
    ...rest,
    start_time: appZoneInputToISO(`${date}T${start}`),
    end_time: appZoneInputToISO(`${date}T${end}`),
  }
}

/** Schedule row → form values. */
export function scheduleToForm(schedule) {
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
