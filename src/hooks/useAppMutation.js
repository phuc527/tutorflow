import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/constants/queryKeys'
import { STALE_WRITE } from '@/services/errors'

/**
 * useMutation plus the behaviour every write in the app needs:
 *   - refresh affected queries (and dashboard stats) after success
 *   - success toast / error toast (errors are already friendly AppErrors from the service layer)
 */
export function useAppMutation({ mutationFn, invalidate = [], successMessage, onSuccess }) {
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
