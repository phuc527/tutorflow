import { QueryClient } from '@tanstack/react-query'
import type { AppError } from '@/services/errors'

// Every query and mutation goes through the service layer, which throws AppError.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: AppError
  }
}

const NO_RETRY = new Set<string | number>(['401', '403', 401, 403, '42501', 'PGRST301'])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Permission errors (RLS / 401 / 403) won't fix themselves; retry only transient failures.
      retry: (failureCount, error) => {
        const { status, code } = error as { status?: string | number; code?: string }
        const key = status ?? code
        if (key !== undefined && NO_RETRY.has(key)) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
