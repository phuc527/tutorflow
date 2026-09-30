import { useRouteError } from 'react-router'
import { ErrorState } from '@/components/common/States'

/** Shown when a page throws while rendering, instead of a blank white screen. */
export default function RouteErrorPage() {
  const error = useRouteError()
  console.error(error)
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <ErrorState
        title="This page crashed"
        error={error instanceof Error ? error : { message: error?.statusText ?? 'Unexpected error' }}
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
