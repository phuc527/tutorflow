/**
 * Colour theme helpers. The user's choice ('light' | 'dark' | 'system') is saved on their profile;
 * localStorage only caches it so public/theme-init.js can paint the right colours before React loads.
 * Keep THEME_STORAGE_KEY and the resolving rule in sync with public/theme-init.js.
 */
export const THEMES = Object.freeze(['light', 'dark', 'system'])
export const THEME_STORAGE_KEY = 'tutorflow-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(preference, systemPrefersDark) {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.includes(value) ? value : 'system'
  } catch {
    return 'system' // storage blocked (private mode, strict privacy settings)
  }
}

export function storeTheme(preference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Not fatal: the profile still holds the choice for signed-in users.
  }
}

export const systemDarkQuery = () => window.matchMedia(DARK_QUERY)

export function applyTheme(resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}
