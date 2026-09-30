// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '@/features/auth/authContext'
import { usersService } from '@/services/usersService'
import { studentsService } from '@/services/studentsService'
import UsersPage from './UsersPage'

vi.mock('@/services/usersService', () => ({
  usersService: { list: vi.fn(), setRole: vi.fn(), linkStudent: vi.fn(), unlinkStudent: vi.fn() },
}))
vi.mock('@/services/studentsService', () => ({ studentsService: { listOptions: vi.fn() } }))

const ME = { id: 'admin-1', email: 'owner@example.com', full_name: 'Owner', role: 'admin', teacher: null, studentLinks: [] }
const PARENT = {
  id: 'parent-1', email: 'lan.vo@example.com', full_name: 'Mai', role: 'student', teacher: null,
  studentLinks: [{ student: { id: 's2', full_name: 'Võ Ngọc Lan' } }],
}
const TEACHER = { id: 't-1', email: 'teacher1@example.com', full_name: 'An', role: 'teacher', teacher: { id: 'T1', full_name: 'Nguyễn Văn An' }, studentLinks: [] }

beforeEach(() => {
  usersService.list.mockResolvedValue([ME, PARENT, TEACHER])
  usersService.setRole.mockResolvedValue(null)
  usersService.unlinkStudent.mockResolvedValue(null)
  studentsService.listOptions.mockResolvedValue([{ id: 's2', full_name: 'Võ Ngọc Lan' }, { id: 's5', full_name: 'Bùi Anh Khoa' }])
})
afterEach(cleanup)

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={{ user: { id: ME.id }, profile: ME, role: 'admin' }}>
        <UsersPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

const rowOf = async (email) => (await screen.findByText(email)).closest('tr')

describe('Users page', () => {
  test('admin rows (including your own) have no role picker', async () => {
    renderPage()
    expect(within(await rowOf(ME.email)).queryByRole('combobox', { name: /role/i })).toBeNull()
  })

  test('changing a student to teacher calls set_user_role', async () => {
    renderPage()
    fireEvent.change(within(await rowOf(PARENT.email)).getByRole('combobox', { name: /role/i }), { target: { value: 'teacher' } })
    await vi.waitFor(() => expect(usersService.setRole).toHaveBeenCalledWith('parent-1', 'teacher'))
  })

  test('shows what each account is linked to, and a linked student can be removed', async () => {
    renderPage()
    expect(within(await rowOf(TEACHER.email)).getByText('Nguyễn Văn An')).toBeTruthy()
    fireEvent.click(within(await rowOf(PARENT.email)).getByRole('button', { name: 'Remove Võ Ngọc Lan' }))
    await vi.waitFor(() => expect(usersService.unlinkStudent).toHaveBeenCalledWith('parent-1', 's2'))
  })
})
