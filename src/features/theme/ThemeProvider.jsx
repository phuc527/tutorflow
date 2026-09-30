import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/authContext'
import { authService } from '@/services/authService'
import { applyTheme, readStoredTheme, resolveTheme, storeTheme, systemDarkQuery } from './theme'
import { ThemeContext } from './themeContext'

/**
 * Source of truth: the signed-in user's profile.theme. Logged out (or before the profile loads) the
 * choice cached in this browser is used. Must sit inside <AuthProvider>.
 */
export function ThemeProvider({ children }) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [localTheme, setLocalTheme] = useState(readStoredTheme)
  const [systemDark, setSystemDark] = useState(() => systemDarkQuery().matches)

  const userId = user?.id
  const profileTheme = profile?.theme
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
    const onChange = (event) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback(
    async (next) => {
      setLocalTheme(next)
      storeTheme(next)
      if (!userId) return
      // Optimistic: the cached profile is the single source of truth, so update it first and roll it
      // back if the save fails.
      const key = ['auth', 'profile', userId]
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (current) => (current ? { ...current, theme: next } : current))
      try {
        await authService.updateTheme(userId, next)
      } catch (error) {
        queryClient.setQueryData(key, previous)
        storeTheme(previous?.theme ?? 'system')
        toast.error(`Couldn’t save your theme: ${error.message}`)
      }
    },
    [userId, queryClient],
  )

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
