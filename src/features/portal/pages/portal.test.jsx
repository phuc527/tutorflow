// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { portalService } from '@/services/portalService'
import MyClassesPage from './MyClassesPage'
import MyFeesPage from './MyFeesPage'

vi.mock('@/services/portalService', () => ({
  portalService: { myStudents: vi.fn(), mySchedule: vi.fn(), myPayments: vi.fn() },
}))

const LAN = { id: 's2', full_name: 'Võ Ngọc Lan', grade: 11, status: 'active' }
const TRANG = { id: 's4', full_name: 'Hoàng Thu Trang', grade: 12, status: 'active' }

beforeEach(() => {
  portalService.myStudents.mockResolvedValue([LAN])
  portalService.mySchedule.mockResolvedValue([
    { id: 'c1', student_id: 's2', student_name: 'Võ Ngọc Lan', title: 'Grammar', subject: 'English', start_time: '2026-10-05T02:00:00Z', end_time: '2026-10-05T03:00:00Z', location: 'Room 2', teacher_name: 'Trần Thị Bình' },
  ])
  portalService.myPayments.mockResolvedValue([
    { id: 'p1', student_id: 's2', student_name: 'Võ Ngọc Lan', teacher_name: 'Trần Thị Bình', billing_month: '2026-10-01', amount: 500000, status: 'unpaid', paid_at: null },
  ])
})
afterEach(cleanup)

const renderPage = (Page) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Page />
    </QueryClientProvider>,
  )

describe('student pages', () => {
  test('My classes lists the class with time (Vietnam time), subject and teacher', async () => {
    renderPage(MyClassesPage)
    expect(await screen.findByText('Grammar')).toBeTruthy()
    expect(screen.getByText(/09:00–10:00/)).toBeTruthy()
    expect(screen.getByText(/Trần Thị Bình/)).toBeTruthy()
    expect(screen.queryByText('Võ Ngọc Lan')).toBeNull() // one child: no name needed
  })

  test('with two linked students each class says whose it is', async () => {
    portalService.myStudents.mockResolvedValue([LAN, TRANG])
    renderPage(MyClassesPage)
    expect(await screen.findByText('Võ Ngọc Lan')).toBeTruthy()
  })

  test('My fees shows amount and status', async () => {
    renderPage(MyFeesPage)
    expect(await screen.findByText('Unpaid')).toBeTruthy()
    expect(screen.getByText(/500\.000/)).toBeTruthy()
  })

  test('an account with no linked student sees how to get access', async () => {
    portalService.myStudents.mockResolvedValue([])
    renderPage(MyFeesPage)
    expect(await screen.findByText(/isn’t linked to a student yet/)).toBeTruthy()
    expect(portalService.myPayments).not.toHaveBeenCalled()
  })
})
