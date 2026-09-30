import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

/** `{ theme, resolvedTheme, setTheme }`. Must be used inside <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
