import { useRouteError } from 'react-router'
import { ErrorState } from '@/components/common/States'
import { clearChunkReloadFlag, isChunkLoadError, reloadOnceForChunkError } from '@/utils/chunkReload'

/** Shown when a page throws while rendering, instead of a blank white screen. */
export default function RouteErrorPage() {
  const error = useRouteError()
  const chunkError = isChunkLoadError(error)

  // A stale tab after a redeploy: reload once to get the new files instead of showing a crash.
  if (chunkError && reloadOnceForChunkError()) return null
  if (!chunkError) clearChunkReloadFlag()

  console.error(error)
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <ErrorState
        title={chunkError ? 'A new version of TutorFlow is available' : 'This page crashed'}
        error={error instanceof Error ? error : { message: error?.statusText ?? 'Unexpected error' }}
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
