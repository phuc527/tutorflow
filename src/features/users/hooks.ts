import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation } from '@/hooks/useAppMutation'
import { studentsService } from '@/services/studentsService'
import { usersService, type UserAccount } from '@/services/usersService'
import type { Role } from '@/types/domain'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users.list(), queryFn: () => usersService.list() })
}

export function useStudentOptions() {
  return useQuery({ queryKey: queryKeys.students.options(), queryFn: () => studentsService.listOptions() })
}

// A role change can link/unlink teacher records, so the teachers list refreshes too.
const INVALIDATE = [queryKeys.users.all, queryKeys.teachers.all]

interface StudentLink {
  profileId: string
  studentId: string
}

export function useSetUserRole() {
  return useAppMutation({
    mutationFn: ({ user, role }: { user: UserAccount; role: Exclude<Role, 'admin'> }) => usersService.setRole(user.id, role),
    invalidate: INVALIDATE,
    successMessage: (_data, { user, role }) => `${user.full_name || user.email} is now a ${role}`,
  })
}

export function useLinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }: StudentLink) => usersService.linkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student linked',
  })
}

export function useUnlinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }: StudentLink) => usersService.unlinkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student unlinked',
  })
}
