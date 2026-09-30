import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Permission errors (RLS / 401 / 403) won't fix themselves; retry only transient failures.
      retry: (failureCount, error) => {
        const status = error?.status ?? error?.code
        if (['401', '403', 401, 403, '42501', 'PGRST301'].includes(status)) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
