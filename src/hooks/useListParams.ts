import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * List state (search, filters, page) stored in the URL query string, so refresh, back/forward
 * and shared links all keep the current view. Changing any filter resets to page 1.
 *
 *   const { params, setParam, setPage } = useListParams({ q: '', status: '' })
 */
export function useListParams<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams()

  const serialized = searchParams.toString()
  const params = useMemo(() => {
    const current = new URLSearchParams(serialized)
    const values: Record<string, string> = {}
    for (const [key, fallback] of Object.entries(defaults)) values[key] = current.get(key) ?? fallback
    return { ...(values as T), page: Math.max(1, Number(current.get('page')) || 1) }
    // `defaults` is a literal at the call site; its keys never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized])

  const setParam = useCallback(
    (key: keyof T & string, value: string | null | undefined) =>
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
    (page: number) =>
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
