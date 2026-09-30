import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/constants/queryKeys'
import { STALE_WRITE } from '@/services/errors'

interface AppMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  invalidate?: readonly QueryKey[]
  successMessage?: string | ((data: TData, variables: TVariables) => string | undefined)
  onSuccess?: (data: TData, variables: TVariables) => void
}

/**
 * useMutation plus the behaviour every write in the app needs:
 *   - refresh affected queries (and dashboard stats) after success
 *   - success toast / error toast (errors are already friendly AppErrors from the service layer)
 */
export function useAppMutation<TData = unknown, TVariables = void>({
  mutationFn,
  invalidate = [],
  successMessage,
  onSuccess,
}: AppMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(
        [...invalidate, queryKeys.dashboard.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      const message = typeof successMessage === 'function' ? successMessage(data, variables) : successMessage
      if (message) toast.success(message)
      onSuccess?.(data, variables)
    },
    onError: (error) => {
      toast.error(error.message)
      // Someone else changed the record: reload so the user sees the current version.
      if (error.code === STALE_WRITE) {
        for (const queryKey of invalidate) queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}

/** The optional callback the feature mutation hooks accept (e.g. close a dialog after saving). */
export interface MutationHookOptions {
  onSuccess?: () => void
}
