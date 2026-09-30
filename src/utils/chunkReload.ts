const RELOAD_FLAG = 'tutorflow:chunk-reload'

/**
 * After a new deploy, a tab that was already open still references the OLD hashed chunk files,
 * which no longer exist, so opening a lazy page fails with a dynamic-import error.
 */
export function isChunkLoadError(error: unknown) {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message,
  )
}

/**
 * Reload once to pick up the new index.html and chunks. Returns false if we already tried in this
 * tab session (or storage is unavailable), so a genuinely missing file can't cause a reload loop.
 */
export function reloadOnceForChunkError() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Call after a page renders successfully so a future deploy can trigger one reload again. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* storage unavailable */
  }
}
