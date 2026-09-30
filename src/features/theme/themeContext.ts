import { createContext, useContext } from 'react'
import type { ThemePreference } from '@/types/domain'

export interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => Promise<void>
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/** `{ theme, resolvedTheme, setTheme }`. Must be used inside <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
