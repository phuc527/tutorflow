/**
 * Small helpers shared by the service modules for building Supabase list queries.
 */

/**
 * Build a PostgREST `or` filter that case-insensitively matches `term` in any of `columns`.
 * Characters with meaning in PostgREST filter syntax (, ( ) " \) or in LIKE patterns (% *)
 * are stripped so user input can't change the structure of the filter.
 */
export function ilikeAny(columns: string[], term: string) {
  const clean = term.replace(/[,()"\\%*]/g, ' ').trim()
  if (!clean) return null
  return columns.map((column) => `${column}.ilike.%${clean}%`).join(',')
}

/** 1-based page → the inclusive [from, to] row range Supabase's .range() expects. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize
  return [from, from + pageSize - 1]
}

/**
 * Convert '' from form inputs into null for the given optional columns, so they are stored as NULL,
 * not empty strings. Required columns are left alone (the form schemas already reject them empty).
 */
export function emptyToNull<T extends object, K extends keyof T>(
  values: T,
  optionalKeys: readonly K[],
): Omit<T, K> & { [P in K]: T[P] | null } {
  const result: Record<string, unknown> = { ...(values as Record<string, unknown>) }
  for (const key of optionalKeys) {
    const value = values[key]
    if (typeof value === 'string' && value.trim() === '') result[key as string] = null
  }
  return result as Omit<T, K> & { [P in K]: T[P] | null }
}

/** Common list parameters for paginated service calls. */
export interface PageParams {
  page?: number
  pageSize?: number
}
