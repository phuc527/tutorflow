import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { useTheme } from '@/features/theme/themeContext'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="top-right" richColors closeButton theme={resolvedTheme} />
}

/**
 * App-wide context providers. AuthProvider sits inside QueryClientProvider because it uses useQuery;
 * ThemeProvider sits inside AuthProvider because the saved theme lives on the user's profile.
 */
export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
