// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthContextValue } from '../authContext'
import SignupPage from './SignupPage'

afterEach(cleanup)

function renderPage(signUp: AuthContextValue['signUp']) {
  const router = createMemoryRouter([{ path: '/signup', element: <SignupPage /> }], { initialEntries: ['/signup'] })
  render(
    <AuthContext.Provider value={{ signUp } as AuthContextValue}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Nguyễn Văn An' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher1@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('sign-up page', () => {
  test('submits name, email and password, then asks the user to confirm their email', async () => {
    const signUp = vi.fn().mockResolvedValue({})
    renderPage(signUp)
    fillAndSubmit()
    expect(await screen.findByText('Check your email')).toBeTruthy()
    expect(signUp).toHaveBeenCalledWith({ fullName: 'Nguyễn Văn An', email: 'teacher1@example.com', password: 'secret123' })
  })

  test('shows the server’s refusal and stays on the form', async () => {
    const signUp = vi.fn().mockRejectedValue(new Error('This email hasn’t been added by your tutoring center.'))
    renderPage(signUp)
    fillAndSubmit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/hasn’t been added/)
    expect(screen.queryByText('Check your email')).toBeNull()
  })

  test('links back to sign in', async () => {
    renderPage(vi.fn())
    expect((await screen.findByRole('link', { name: 'Sign in' })).getAttribute('href')).toBe('/login')
  })
})
