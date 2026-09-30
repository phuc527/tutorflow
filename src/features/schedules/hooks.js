import { useCallback, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation } from '@/hooks/useAppMutation'
import { schedulesService } from '@/services/schedulesService'
import { CALENDAR_VIEWS, getViewRange, isDayKey, todayKey } from '@/utils/calendar'
import { toUtcISO } from '@/utils/datetime'

const VIEW_VALUES = CALENDAR_VIEWS.map((v) => v.value)

/** Calendar state in the URL: ?view=week&date=2026-10-01&teacherId=…&studentId=… */
export function useCalendarParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view')
  const rawDate = searchParams.get('date')

  const params = {
    view: VIEW_VALUES.includes(rawView) ? rawView : 'week',
    date: isDayKey(rawDate) ? rawDate : todayKey(),
    teacherId: searchParams.get('teacherId') ?? '',
    studentId: searchParams.get('studentId') ?? '',
  }

  const setParams = useCallback(
    (changes) =>
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

export function useSchedulesInRange({ view, date, teacherId, studentId }) {
  const range = useMemo(() => getViewRange(view, date), [view, date])
  const key = { from: toUtcISO(range.from), to: toUtcISO(range.to), teacherId, studentId }
  const query = useQuery({
    queryKey: queryKeys.schedules.range(key),
    queryFn: () => schedulesService.listInRange({ ...range, teacherId, studentId }),
    placeholderData: keepPreviousData,
  })
  return { ...query, range }
}

export function useSaveSchedule({ teacherId, onSuccess } = {}) {
  return useAppMutation({
    mutationFn: ({ id, values }) =>
      id ? schedulesService.update(id, values) : schedulesService.create(teacherId || values.teacher_id, values),
    invalidate: [queryKeys.schedules.all],
    successMessage: (_data, { id }) => (id ? 'Schedule updated' : 'Schedule created'),
    onSuccess,
  })
}

export function useDeleteSchedule({ onSuccess } = {}) {
  return useAppMutation({
    mutationFn: (id) => schedulesService.remove(id),
    invalidate: [queryKeys.schedules.all],
    successMessage: 'Schedule deleted',
    onSuccess,
  })
}
