import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation } from '@/hooks/useAppMutation'
import { studentsService } from '@/services/studentsService'
import { usersService } from '@/services/usersService'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users.list(), queryFn: () => usersService.list() })
}

export function useStudentOptions() {
  return useQuery({ queryKey: queryKeys.students.options(), queryFn: () => studentsService.listOptions() })
}

// A role change can link/unlink teacher records, so the teachers list refreshes too.
const INVALIDATE = [queryKeys.users.all, queryKeys.teachers.all]

export function useSetUserRole() {
  return useAppMutation({
    mutationFn: ({ user, role }) => usersService.setRole(user.id, role),
    invalidate: INVALIDATE,
    successMessage: (_data, { user, role }) => `${user.full_name || user.email} is now a ${role}`,
  })
}

export function useLinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }) => usersService.linkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student linked',
  })
}

export function useUnlinkStudent() {
  return useAppMutation({
    mutationFn: ({ profileId, studentId }) => usersService.unlinkStudent(profileId, studentId),
    invalidate: INVALIDATE,
    successMessage: 'Student unlinked',
  })
}
