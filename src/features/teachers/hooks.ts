import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation, type MutationHookOptions } from '@/hooks/useAppMutation'
import type { TeacherValues } from '@/schemas/teacher'
import { teachersService, type TeacherListParams } from '@/services/teachersService'

export function useTeachersList(params: TeacherListParams) {
  return useQuery({
    queryKey: queryKeys.teachers.list(params),
    queryFn: () => teachersService.list(params),
    // Keep showing the current page while the next one loads (no flash of skeletons on paging).
    placeholderData: keepPreviousData,
  })
}

export function useTeacherOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.teachers.options(),
    queryFn: teachersService.listOptions,
    enabled,
    staleTime: 60_000,
  })
}

export function useTeacherStudentIds(teacherId: string | null | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.teachers.students(teacherId),
    queryFn: () => teachersService.getStudentIds(teacherId!),
    enabled: enabled && Boolean(teacherId),
  })
}

/** Create when `id` is absent, update otherwise. */
export function useSaveTeacher({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: ({ id, values }: { id?: string; values: TeacherValues }) =>
      id ? teachersService.update(id, values) : teachersService.create(values),
    invalidate: [queryKeys.teachers.all, queryKeys.students.all],
    successMessage: (_data, { id }) => (id ? 'Teacher updated' : 'Teacher created'),
    onSuccess,
  })
}

export function useDeleteTeacher({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: (id: string) => teachersService.remove(id),
    invalidate: [queryKeys.teachers.all, queryKeys.students.all, queryKeys.schedules.all],
    successMessage: 'Teacher deleted',
    onSuccess,
  })
}
