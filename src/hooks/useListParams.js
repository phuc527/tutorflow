import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * List state (search, filters, page) stored in the URL query string, so refresh, back/forward
 * and shared links all keep the current view. Changing any filter resets to page 1.
 *
 *   const { params, setParam, setPage } = useListParams({ q: '', status: '' })
 */
export function useListParams(defaults) {
  const [searchParams, setSearchParams] = useSearchParams()

  const serialized = searchParams.toString()
  const params = useMemo(() => {
    const current = new URLSearchParams(serialized)
    const values = {}
    for (const key of Object.keys(defaults)) values[key] = current.get(key) ?? defaults[key]
    values.page = Math.max(1, Number(current.get('page')) || 1)
    return values
    // `defaults` is a literal at the call site; its keys never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])

  const setParam = useCallback(
    (key, value) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === '' || value === null || value === undefined) next.delete(key)
          else next.set(key, value)
          next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setSearchParams],
  )

  const setPage = useCallback(
    (page) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (page <= 1) next.delete('page')
        else next.set('page', String(page))
        return next
      }),
    [setSearchParams],
  )

  return { params, setParam, setPage }
}
