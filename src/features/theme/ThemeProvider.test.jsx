// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AuthContext } from '@/features/auth/authContext'
import { authService } from '@/services/authService'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './themeContext'

vi.mock('@/services/authService', () => ({ authService: { updateTheme: vi.fn() } }))

// jsdom has no matchMedia; pretend the operating system is in light mode.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  authService.updateTheme.mockReset().mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

function Probe() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <p>theme: {theme}</p>
      <button onClick={() => setTheme('dark')}>go dark</button>
    </>
  )
}

// Like AuthProvider: the profile is read from the TanStack Query cache, so saving can update it there.
function FakeAuth({ user, profile, children }) {
  const { data } = useQuery({ queryKey: ['auth', 'profile', user?.id], queryFn: () => profile, initialData: profile, enabled: false })
  return <AuthContext.Provider value={{ user, profile: user ? data : null }}>{children}</AuthContext.Provider>
}

function renderWith({ user = null, profile = null } = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FakeAuth user={user} profile={profile}>
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      </FakeAuth>
    </QueryClientProvider>,
  )
}

const isDark = () => document.documentElement.classList.contains('dark')

describe('ThemeProvider', () => {
  test('a signed-in user gets the theme saved on their profile, on this device too', () => {
    renderWith({ user: { id: 'u1' }, profile: { id: 'u1', theme: 'dark' } })
    expect(isDark()).toBe(true)
    expect(localStorage.getItem('tutorflow-theme')).toBe('dark')
  })

  test('logged out, the theme cached in this browser is used', () => {
    localStorage.setItem('tutorflow-theme', 'dark')
    renderWith({})
    expect(screen.getByText('theme: dark')).toBeTruthy()
    expect(isDark()).toBe(true)
  })

  test('changing the theme applies it at once and saves it to the account', async () => {
    renderWith({ user: { id: 'u1' }, profile: { id: 'u1', theme: 'light' } })
    expect(isDark()).toBe(false)
    await act(async () => fireEvent.click(screen.getByText('go dark')))
    expect(await screen.findByText('theme: dark')).toBeTruthy()
    expect(isDark()).toBe(true)
    expect(authService.updateTheme).toHaveBeenCalledWith('u1', 'dark')
  })

  test('logged out, changing the theme is only remembered in this browser', async () => {
    renderWith({})
    await act(async () => fireEvent.click(screen.getByText('go dark')))
    expect(localStorage.getItem('tutorflow-theme')).toBe('dark')
    expect(authService.updateTheme).not.toHaveBeenCalled()
  })
})

describe('ThemeProvider when saving fails', () => {
  test('the previous theme comes back and the user is told', async () => {
    authService.updateTheme.mockRejectedValue(new Error('offline'))
    renderWith({ user: { id: 'u1' }, profile: { id: 'u1', theme: 'light' } })
    await act(async () => fireEvent.click(screen.getByText('go dark')))
    await waitFor(() => expect(authService.updateTheme).toHaveBeenCalled())
    expect(await screen.findByText('theme: light')).toBeTruthy()
    expect(isDark()).toBe(false)
    expect(localStorage.getItem('tutorflow-theme')).toBe('light')
  })
})
