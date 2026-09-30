import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/authContext'
import { profileQueryKey } from '@/features/auth/AuthProvider'
import { authService, type CurrentProfile } from '@/services/authService'
import { errorMessage } from '@/services/errors'
import type { ThemePreference } from '@/types/domain'
import { applyTheme, isThemePreference, readStoredTheme, resolveTheme, storeTheme, systemDarkQuery } from './theme'
import { ThemeContext, type ThemeContextValue } from './themeContext'

/**
 * Source of truth: the signed-in user's profile.theme. Logged out (or before the profile loads) the
 * choice cached in this browser is used. Must sit inside <AuthProvider>.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [localTheme, setLocalTheme] = useState(readStoredTheme)
  const [systemDark, setSystemDark] = useState(() => systemDarkQuery().matches)

  const userId = user?.id
  const profileTheme = isThemePreference(profile?.theme) ? profile.theme : undefined
  // A loaded profile wins over the browser cache (e.g. the user chose dark on another device).
  const theme = profileTheme ?? localTheme
  const resolvedTheme = resolveTheme(theme, systemDark)

  useEffect(() => {
    if (profileTheme) storeTheme(profileTheme)
  }, [profileTheme])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Follow the operating system live while "system" is selected.
  useEffect(() => {
    const query = systemDarkQuery()
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback(
    async (next: ThemePreference) => {
      setLocalTheme(next)
      storeTheme(next)
      if (!userId) return
      // Optimistic: the cached profile is the single source of truth, so update it first and roll it
      // back if the save fails.
      const key = profileQueryKey(userId)
      const previous = queryClient.getQueryData<CurrentProfile>(key)
      queryClient.setQueryData<CurrentProfile>(key, (current) => (current ? { ...current, theme: next } : current))
      try {
        await authService.updateTheme(userId, next)
      } catch (error) {
        queryClient.setQueryData(key, previous)
        storeTheme(isThemePreference(previous?.theme) ? previous.theme : 'system')
        toast.error(`Couldn’t save your theme: ${errorMessage(error)}`)
      }
    },
    [userId, queryClient],
  )

  const value = useMemo<ThemeContextValue>(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
