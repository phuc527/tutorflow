// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import UnauthorizedPage from './UnauthorizedPage'

afterEach(cleanup)

test('the way back goes to the home page, which differs per role (a student has no dashboard)', async () => {
  const router = createMemoryRouter([{ path: '/unauthorized', element: <UnauthorizedPage /> }], { initialEntries: ['/unauthorized'] })
  render(<RouterProvider router={router} />)
  expect((await screen.findByRole('link')).getAttribute('href')).toBe('/')
})
