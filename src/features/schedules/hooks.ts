import { useCallback, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation, type MutationHookOptions } from '@/hooks/useAppMutation'
import type { ScheduleValues } from '@/schemas/schedule'
import { schedulesService } from '@/services/schedulesService'
import { CALENDAR_VIEWS, getViewRange, isDayKey, todayKey, type CalendarView } from '@/utils/calendar'
import { toUtcISO } from '@/utils/datetime'

const VIEW_VALUES: readonly string[] = CALENDAR_VIEWS.map((v) => v.value)

const isCalendarView = (value: string | null): value is CalendarView => value !== null && VIEW_VALUES.includes(value)

export interface CalendarParams {
  view: CalendarView
  date: string
  teacherId: string
  studentId: string
}

/** Calendar state in the URL: ?view=week&date=2026-10-01&teacherId=…&studentId=… */
export function useCalendarParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view')
  const rawDate = searchParams.get('date')

  const params: CalendarParams = {
    view: isCalendarView(rawView) ? rawView : 'week',
    date: isDayKey(rawDate) ? rawDate : todayKey(),
    teacherId: searchParams.get('teacherId') ?? '',
    studentId: searchParams.get('studentId') ?? '',
  }

  const setParams = useCallback(
    (changes: Partial<CalendarParams>) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      ),
    [setSearchParams],
  )

  return { params, setParams }
}

export function useSchedulesInRange({ view, date, teacherId, studentId }: CalendarParams) {
  const range = useMemo(() => getViewRange(view, date), [view, date])
  const key = { from: toUtcISO(range.from), to: toUtcISO(range.to), teacherId, studentId }
  const query = useQuery({
    queryKey: queryKeys.schedules.range(key),
    queryFn: () => schedulesService.listInRange({ ...range, teacherId, studentId }),
    placeholderData: keepPreviousData,
  })
  return { ...query, range }
}

/**
 * A teacher passes their own `teacherId`; the admin leaves it out and the form supplies `values.teacher_id`.
 */
export function useSaveSchedule({ teacherId, onSuccess }: MutationHookOptions & { teacherId?: string | null } = {}) {
  return useAppMutation({
    mutationFn: ({ id, values }: { id?: string; values: ScheduleValues }) =>
      id ? schedulesService.update(id, values) : schedulesService.create(teacherId || values.teacher_id || '', values),
    invalidate: [queryKeys.schedules.all],
    successMessage: (_data, { id }) => (id ? 'Schedule updated' : 'Schedule created'),
    onSuccess,
  })
}

export function useDeleteSchedule({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: (id: string) => schedulesService.remove(id),
    invalidate: [queryKeys.schedules.all],
    successMessage: 'Schedule deleted',
    onSuccess,
  })
}
