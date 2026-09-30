import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { portalService } from '@/services/portalService'

export function useMyStudents() {
  return useQuery({ queryKey: queryKeys.portal.students(), queryFn: () => portalService.myStudents() })
}

/** `range` holds ISO instants. */
export function useMySchedule(range: { from: string; to: string }, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.portal.schedule(range),
    queryFn: () => portalService.mySchedule(range),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useMyPayments({ enabled }: { enabled: boolean }) {
  return useQuery({ queryKey: queryKeys.portal.payments(), queryFn: () => portalService.myPayments(), enabled })
}
