/**
 * Small helpers shared by the service modules for building Supabase list queries.
 */

/**
 * Build a PostgREST `or` filter that case-insensitively matches `term` in any of `columns`.
 * Characters with meaning in PostgREST filter syntax (, ( ) " \) or in LIKE patterns (% *)
 * are stripped so user input can't change the structure of the filter.
 */
export function ilikeAny(columns, term) {
  const clean = term.replace(/[,()"\\%*]/g, ' ').trim()
  if (!clean) return null
  return columns.map((column) => `${column}.ilike.%${clean}%`).join(',')
}

/** 1-based page → the inclusive [from, to] row range Supabase's .range() expects. */
export function pageRange(page, pageSize) {
  const from = (page - 1) * pageSize
  return [from, from + pageSize - 1]
}

/** Convert '' from form inputs into null so optional columns are stored as NULL, not empty strings. */
export function emptyToNull(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? null : value]),
  )
}
