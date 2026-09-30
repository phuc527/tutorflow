import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { dashboardService } from '@/services/dashboardService'

// Every mutation invalidates queryKeys.dashboard.all (see useAppMutation), so these stay fresh.
export function useDashboardSummary() {
  return useQuery({ queryKey: [...queryKeys.dashboard.all, 'summary'], queryFn: dashboardService.summary })
}

export function useUpcomingClasses() {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'upcoming'],
    queryFn: () => dashboardService.upcomingClasses(6),
  })
}
